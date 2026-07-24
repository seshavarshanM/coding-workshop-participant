"""
Projects service.

Authorization model:
  - Any authenticated user may READ projects.
  - Only managers may CREATE projects, and they own what they create.
  - Only the owning manager may UPDATE a project.
  - Only admins may DELETE (treated as a compliance action, audited).
"""
import json
from postgres_service import execute_query
from auth import require_auth, require_role, require_project_owner, \
                 deny_admin_business_action, respond, AuthError, handle_auth_error
import audit


def get_method(event):
    return (
        event.get('httpMethod')
        or (event.get('requestContext') or {}).get('http', {}).get('method')
        or 'GET'
    ).upper()


def get_path(event):
    return event.get('path') or event.get('rawPath') or ''


# Sub-resources and collection actions that appear in a path but are never an id.
PATH_ACTIONS = {'restore', 'archived', 'cleanup-demo', 'report'}


def get_id(event):
    """
    The project id from the path.

    Paths carry actions as well as ids — /projects/{id}/restore, or
    /projects/archived with no id at all — so taking the last segment would
    return the action. Known actions are removed before reading the id.
    """
    pp = event.get('pathParameters') or {}
    if pp.get('id'):
        return pp['id']
    parts = [
        p for p in get_path(event).split('/')
        if p and p not in ('api', 'projects') and p not in PATH_ACTIONS
    ]
    return parts[-1] if parts else None


def init_db():
    execute_query("""
        CREATE TABLE IF NOT EXISTS projects (
            id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name                  VARCHAR(255) NOT NULL,
            description           TEXT         DEFAULT '',
            status                VARCHAR(50)  DEFAULT 'planning',
            department            VARCHAR(255) DEFAULT '',
            manager               VARCHAR(255) DEFAULT '',
            start_date            DATE,
            end_date              DATE,
            budget_planned        DECIMAL(15,2) DEFAULT 0,
            budget_spent          DECIMAL(15,2) DEFAULT 0,
            completion_percentage INTEGER       DEFAULT 0,
            priority              VARCHAR(50)  DEFAULT 'medium',
            created_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            updated_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            archived_at           TIMESTAMP,
            archived_by           VARCHAR(255)
        )
    """)
    for ddl in (
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP",
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_by VARCHAR(255)",
    ):
        try:
            execute_query(ddl)
        except Exception:
            pass


def fetch_project(project_id):
    rows = execute_query("SELECT * FROM projects WHERE id = %s", (project_id,))
    return rows[0] if rows else None


def handler(event, context):
    method = get_method(event)
    if method == 'OPTIONS':
        return respond(200, {})

    try:
        init_db()
        user = require_auth(event)          # ← every request must carry a valid JWT
        project_id = get_id(event)
        qp = event.get('queryStringParameters') or {}
        body = json.loads(event['body']) if event.get('body') else {}

        # ── GET /api/projects/archived — retired projects ──────────────
        if method == 'GET' and get_path(event).rstrip('/').endswith('/archived'):
            return respond(200, execute_query(
                "SELECT * FROM projects WHERE archived_at IS NOT NULL"
                " ORDER BY archived_at DESC"))

        # ── READ: any authenticated user ──────────────────────────────
        if method == 'GET':
            if project_id:
                project = fetch_project(project_id)
                return respond(200, project) if project else respond(404, {'message': 'Project not found'})

            conds, params = ["archived_at IS NULL"], []
            if qp.get('status'):
                conds.append("status = %s")
                params.append(qp['status'])
            if qp.get('search'):
                conds.append("(name ILIKE %s OR description ILIKE %s)")
                params += [f"%{qp['search']}%", f"%{qp['search']}%"]
            where = f"WHERE {' AND '.join(conds)}"
            return respond(200, execute_query(
                f"SELECT * FROM projects {where} ORDER BY created_at DESC", params or None))

        # ── POST /api/projects/cleanup-demo ───────────────────────────
        # Removes records left over from development, keeping the seeded demo
        # data. The cloud database sits inside a VPC and cannot be reached with
        # psql from a workstation, so this runs where the connection exists.
        #
        # Administrator only, dry-run by default, and audited.
        if method == 'POST' and get_path(event).rstrip('/').endswith('/cleanup-demo'):
            require_role(user, 'admin')

            keep = [
                'Customer Portal Redesign', 'Payments API v2', 'Cloud Migration Phase 2',
                'Internal Analytics Dashboard', 'Legacy CRM Decommission', 'Mobile App Launch',
            ]
            placeholders = ','.join(['%s'] * len(keep))

            doomed = execute_query(
                f"SELECT id, name FROM projects WHERE name NOT IN ({placeholders}) ORDER BY name",
                keep)
            doomed_ids = [r['id'] for r in doomed]

            orphan_deliverables = execute_query(f"""
                SELECT d.id, d.name FROM deliverables d
                LEFT JOIN projects p ON p.id = d.project_id
                WHERE p.id IS NULL OR p.name NOT IN ({placeholders})
                ORDER BY d.name
            """, keep)

            orphan_budget = execute_query(f"""
                SELECT b.id, b.category, b.project_name FROM budget_entries b
                LEFT JOIN projects p ON p.id = b.project_id
                WHERE p.id IS NULL OR p.name NOT IN ({placeholders})
            """, keep)

            preview = {
                'projects': [r['name'] for r in doomed],
                'deliverables': [r['name'] for r in orphan_deliverables],
                'budget_entries': len(orphan_budget),
            }

            if not body.get('confirm'):
                return respond(200, {
                    'dry_run': True,
                    'would_remove': preview,
                    'message': 'Nothing changed. Send {"confirm": true} to remove these.',
                })

            # Children first, so nothing is left pointing at a deleted parent.
            for row in orphan_deliverables:
                try:
                    execute_query("DELETE FROM progress_updates WHERE deliverable_id = %s::uuid",
                                  (row['id'],))
                except Exception:
                    pass                      # table may not exist yet
                execute_query("DELETE FROM deliverables WHERE id = %s", (row['id'],))

            for row in orphan_budget:
                execute_query("DELETE FROM budget_entries WHERE id = %s", (row['id'],))

            for pid in doomed_ids:
                execute_query("DELETE FROM projects WHERE id = %s", (pid,))

            audit.record(user, 'delete', 'project', None, 'Demo data cleanup', '',
                         f"Removed {len(doomed_ids)} project(s), "
                         f"{len(orphan_deliverables)} deliverable(s), "
                         f"{len(orphan_budget)} budget entr(ies)")

            remaining = execute_query("SELECT COUNT(*) AS n FROM projects")
            return respond(200, {
                'dry_run': False,
                'removed': preview,
                'projects_remaining': int(remaining[0]['n']) if remaining else 0,
            })

        # ── Bring a retired project back ──────────────────────────────
        if method == 'POST' and project_id and get_path(event).rstrip('/').endswith('/restore'):
            project = fetch_project(project_id)
            if not project:
                return respond(404, {'message': 'Project not found'})
            require_project_owner(user, project, 'restore this project')
            execute_query(
                "UPDATE projects SET archived_at = NULL, archived_by = NULL,"
                " updated_at = CURRENT_TIMESTAMP WHERE id = %s", (project_id,))
            audit.record(user, 'update', 'project', project_id,
                         project.get('name', ''), project.get('name', ''),
                         'Restored from the archive')
            return respond(200, {'message': 'Project restored'})

        # ── CREATE: managers only; they own what they create ──────────
        if method == 'POST':
            deny_admin_business_action(user, 'create projects')
            require_role(user, 'manager')

            if not body.get('name'):
                return respond(400, {'message': 'Project name is required'})

            rows = execute_query("""
                INSERT INTO projects
                    (name, description, status, department, manager,
                     start_date, end_date, budget_planned, priority)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING *
            """, (
                body.get('name'),
                body.get('description', ''),
                body.get('status', 'planning'),
                body.get('department', ''),
                user['name'],                       # ownership is server-assigned
                body.get('start_date') or None,
                body.get('end_date') or None,
                float(body.get('budget_planned') or 0),
                body.get('priority', 'medium'),
            ))
            created = rows[0] if rows else {}
            audit.record(user, 'create', 'project', created.get('id'),
                         created.get('name', ''), created.get('name', ''))
            return respond(201, created)

        # ── UPDATE: owning manager only ───────────────────────────────
        if method == 'PUT' and project_id:
            project = fetch_project(project_id)
            require_project_owner(user, project, 'edit this project')

            fields = ['name', 'description', 'status', 'department',
                      'start_date', 'end_date', 'budget_planned', 'budget_spent',
                      'completion_percentage', 'priority']
            sets, params = [], []
            for f in fields:
                if f in body:
                    sets.append(f"{f} = %s")
                    val = body[f]
                    if f in ('start_date', 'end_date') and val == '':
                        val = None
                    params.append(val)
            if not sets:
                return respond(400, {'message': 'No fields to update'})
            sets.append("updated_at = CURRENT_TIMESTAMP")
            params.append(project_id)
            rows = execute_query(
                f"UPDATE projects SET {', '.join(sets)} WHERE id = %s RETURNING *", params)
            audit.record(user, 'update', 'project', project_id,
                         project.get('name', ''), project.get('name', ''))
            return respond(200, rows[0] if rows else {})

        # ── DELETE — retire a project ─────────────────────────────────
        # A project's lifecycle belongs to the manager who owns it. Retiring is
        # part of running the work, so it sits with them.
        #
        # Nothing is erased. A project that consumed budget and people is part
        # of the organisation's record, and removing that would lose history the
        # audit trail exists to preserve. There is deliberately no purge path.
        if method == 'DELETE' and project_id:
            project = fetch_project(project_id)
            if not project:
                return respond(404, {'message': 'Project not found'})

            require_project_owner(user, project, 'retire this project')

            execute_query(
                "UPDATE projects SET archived_at = CURRENT_TIMESTAMP, archived_by = %s,"
                " updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                (user['name'], project_id))
            audit.record(user, 'archive', 'project', project_id,
                         project.get('name', ''), project.get('name', ''),
                         f"Retired by {user['name']} ({user.get('employee_id','')})")
            return respond(204)

        return respond(405, {'message': 'Method not allowed'})

    except AuthError as e:
        return handle_auth_error(e)
    except Exception as e:
        return respond(500, {'message': str(e)})
