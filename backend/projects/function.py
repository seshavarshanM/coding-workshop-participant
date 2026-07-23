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


def get_id(event):
    pp = event.get('pathParameters') or {}
    if pp.get('id'):
        return pp['id']
    parts = [p for p in get_path(event).split('/') if p and p not in ('api', 'projects')]
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
            updated_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
    """)


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

        # ── READ: any authenticated user ──────────────────────────────
        if method == 'GET':
            if project_id:
                project = fetch_project(project_id)
                return respond(200, project) if project else respond(404, {'message': 'Project not found'})

            conds, params = [], []
            if qp.get('status'):
                conds.append("status = %s")
                params.append(qp['status'])
            if qp.get('search'):
                conds.append("(name ILIKE %s OR description ILIKE %s)")
                params += [f"%{qp['search']}%", f"%{qp['search']}%"]
            where = f"WHERE {' AND '.join(conds)}" if conds else ""
            return respond(200, execute_query(
                f"SELECT * FROM projects {where} ORDER BY created_at DESC", params or None))

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

        # ── DELETE: admin only (compliance action) ────────────────────
        if method == 'DELETE' and project_id:
            require_role(user, 'admin')
            project = fetch_project(project_id)
            if not project:
                return respond(404, {'message': 'Project not found'})
            execute_query("DELETE FROM projects WHERE id = %s", (project_id,))
            audit.record(user, 'delete', 'project', project_id,
                         project.get('name', ''), project.get('name', ''),
                         'Compliance deletion by system administrator')
            return respond(200, {'message': 'Project deleted'})

        return respond(405, {'message': 'Method not allowed'})

    except AuthError as e:
        return handle_auth_error(e)
    except Exception as e:
        return respond(500, {'message': str(e)})
