"""
Deliverables service.

Managers create and manage deliverables on projects they own.
Members may update status/completion only on deliverables assigned to them.
Administrators oversee but do not assign work.
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
    parts = [p for p in get_path(event).split('/') if p and p not in ('api', 'deliverables')]
    return parts[-1] if parts else None


def init_db():
    execute_query("""
        CREATE TABLE IF NOT EXISTS deliverables (
            id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id            UUID,
            project_name          VARCHAR(255) DEFAULT '',
            name                  VARCHAR(255) NOT NULL,
            description           TEXT         DEFAULT '',
            status                VARCHAR(50)  DEFAULT 'pending',
            due_date              DATE,
            assigned_to           VARCHAR(255) DEFAULT '',
            depends_on            UUID,
            completion_percentage INTEGER      DEFAULT 0,
            created_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            updated_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
    """)


def fetch_project(project_id):
    rows = execute_query("SELECT * FROM projects WHERE id = %s", (project_id,))
    return rows[0] if rows else None


def fetch_deliverable(item_id):
    rows = execute_query("SELECT * FROM deliverables WHERE id = %s", (item_id,))
    return rows[0] if rows else None


def sync_project_completion(project_id):
    """Tier A: project completion is derived from its deliverables."""
    if not project_id:
        return
    rows = execute_query(
        "SELECT completion_percentage FROM deliverables WHERE project_id = %s", (project_id,))
    if rows:
        avg = round(sum(int(r['completion_percentage'] or 0) for r in rows) / len(rows))
        execute_query(
            "UPDATE projects SET completion_percentage = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
            (avg, project_id))


def dependency_complete(depends_on):
    """
    Finish-to-start: a deliverable may not record progress until the work it
    depends on has finished. Returns (ok, message).
    """
    if not depends_on:
        return True, ''
    rows = execute_query(
        "SELECT name, status, completion_percentage FROM deliverables WHERE id = %s",
        (depends_on,))
    if not rows:
        return True, ''          # dangling reference — do not block on it
    dep = rows[0]
    if dep['status'] == 'completed':
        return True, ''
    return False, (
        f"Cannot start this deliverable: \"{dep['name']}\" must be completed "
        f"first (currently {dep['completion_percentage'] or 0}%)"
    )


def normalize_status(status, pct):
    """Status and completion must never contradict each other."""
    if pct is None:
        return status, pct
    pct = max(0, min(100, int(pct)))
    if pct == 100:
        return 'completed', 100
    if pct == 0 and status == 'completed':
        return 'pending', 0
    if status == 'completed' and pct < 100:
        return 'in_progress', pct
    return status, pct


def handler(event, context):
    method = get_method(event)
    if method == 'OPTIONS':
        return respond(200, {})

    try:
        init_db()
        user = require_auth(event)
        item_id = get_id(event)
        qp = event.get('queryStringParameters') or {}
        body = json.loads(event['body']) if event.get('body') else {}

        # ── READ ──────────────────────────────────────────────────────
        if method == 'GET':
            if item_id:
                item = fetch_deliverable(item_id)
                return respond(200, item) if item else respond(404, {'message': 'Not found'})

            conds, params = [], []
            if qp.get('project_id'):
                conds.append("project_id = %s::uuid")
                params.append(qp['project_id'])
            if qp.get('status'):
                conds.append("status = %s")
                params.append(qp['status'])
            if qp.get('assigned_to'):
                conds.append("assigned_to = %s")
                params.append(qp['assigned_to'])
            where = f"WHERE {' AND '.join(conds)}" if conds else ""
            return respond(200, execute_query(
                f"SELECT * FROM deliverables {where} ORDER BY due_date ASC NULLS LAST",
                params or None))

        # ── CREATE: owning manager only ───────────────────────────────
        if method == 'POST':
            deny_admin_business_action(user, 'create deliverables')
            project = fetch_project(body.get('project_id'))
            require_project_owner(user, project, 'add deliverables to this project')

            wants_progress = (
                int(body.get('completion_percentage') or 0) > 0
                or body.get('status') in ('in_progress', 'completed')
            )
            if wants_progress:
                ok, msg = dependency_complete(body.get('depends_on'))
                if not ok:
                    return respond(400, {'message': msg})
            status, pct = normalize_status(
                body.get('status', 'pending'), body.get('completion_percentage', 0))
            rows = execute_query("""
                INSERT INTO deliverables
                    (project_id, project_name, name, description, status,
                     due_date, assigned_to, depends_on, completion_percentage)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING *
            """, (
                body.get('project_id'),
                project.get('name', ''),
                body.get('name', 'Untitled Deliverable'),
                body.get('description', ''),
                status,
                body.get('due_date') or None,
                body.get('assigned_to', ''),
                body.get('depends_on') or None,
                pct,
            ))
            created = rows[0] if rows else {}
            sync_project_completion(body.get('project_id'))
            audit.record(user, 'create', 'deliverable', created.get('id'),
                         created.get('name', ''), project.get('name', ''))
            return respond(201, created)

        # ── UPDATE ────────────────────────────────────────────────────
        if method == 'PUT' and item_id:
            item = fetch_deliverable(item_id)
            if not item:
                return respond(404, {'message': 'Not found'})
            project = fetch_project(item.get('project_id'))

            is_assignee = item.get('assigned_to') == user.get('name')
            is_owner = project and project.get('manager') == user.get('name') and user['role'] == 'manager'

            # Members (and non-owning managers) may only self-report progress.
            progress_only_fields = {'status', 'completion_percentage'}
            requested = set(body.keys())

            if is_owner:
                pass                                    # full edit allowed
            elif is_assignee and requested <= progress_only_fields:
                pass                                    # self-reporting allowed
            else:
                raise AuthError(403,
                    'You can only update deliverables on projects you manage, '
                    'or report progress on work assigned to you')

            fields = ['project_name', 'name', 'description', 'status', 'due_date',
                      'assigned_to', 'depends_on', 'completion_percentage']
            payload = dict(body)

            # Check the dependency against what the caller ASKED for, before any
            # normalisation rewrites it — otherwise an invalid request is
            # silently downgraded instead of being rejected.
            wants_progress = (
                int(body.get('completion_percentage') or 0) > 0
                or body.get('status') in ('in_progress', 'completed')
            )
            if wants_progress:
                depends_on = body.get('depends_on', item.get('depends_on'))
                ok, msg = dependency_complete(depends_on)
                if not ok:
                    return respond(400, {'message': msg})

            if 'status' in payload or 'completion_percentage' in payload:
                s, p = normalize_status(
                    payload.get('status', item.get('status')),
                    payload.get('completion_percentage', item.get('completion_percentage')))
                payload['status'] = s
                payload['completion_percentage'] = p

            sets, params = [], []
            for f in fields:
                if f in payload:
                    sets.append(f"{f} = %s")
                    val = payload[f]
                    if f in ('due_date', 'depends_on') and val == '':
                        val = None
                    params.append(val)
            if not sets:
                return respond(400, {'message': 'No fields to update'})
            sets.append("updated_at = CURRENT_TIMESTAMP")
            params.append(item_id)
            rows = execute_query(
                f"UPDATE deliverables SET {', '.join(sets)} WHERE id = %s RETURNING *", params)
            sync_project_completion(item.get('project_id'))
            audit.record(user, 'update', 'deliverable', item_id,
                         item.get('name', ''), item.get('project_name', ''))
            return respond(200, rows[0] if rows else {})

        # ── DELETE: owning manager only ───────────────────────────────
        if method == 'DELETE' and item_id:
            deny_admin_business_action(user, 'delete deliverables')
            item = fetch_deliverable(item_id)
            if not item:
                return respond(404, {'message': 'Not found'})
            project = fetch_project(item.get('project_id'))
            require_project_owner(user, project, 'delete deliverables on this project')

            execute_query("DELETE FROM deliverables WHERE id = %s", (item_id,))
            sync_project_completion(item.get('project_id'))
            audit.record(user, 'delete', 'deliverable', item_id,
                         item.get('name', ''), item.get('project_name', ''),
                         f"Removed by {user['name']}")
            return respond(200, {'message': 'Deliverable deleted', 'deleted_by': user['name']})

        # ── POST /api/deliverables/repair — correct impossible states ─────
        # Rows created before the finish-to-start rule existed may record
        # progress while their predecessor is unfinished. Reset those to
        # 'blocked' at 0% so the data reflects what is actually true.
        if method == 'POST' and get_path(event).rstrip('/').endswith('/repair'):
            require_role(user, 'admin', 'manager')
            rows = execute_query("SELECT * FROM deliverables WHERE depends_on IS NOT NULL")
            fixed = []
            for r in rows:
                ok, _ = dependency_complete(r['depends_on'])
                if not ok and (int(r['completion_percentage'] or 0) > 0
                               or r['status'] in ('in_progress', 'completed')):
                    execute_query(
                        "UPDATE deliverables SET status='blocked', completion_percentage=0,"
                        " updated_at=CURRENT_TIMESTAMP WHERE id = %s", (r['id'],))
                    fixed.append(r['name'])
            for pid in {r['project_id'] for r in rows if r.get('project_id')}:
                sync_project_completion(pid)
            audit.record(user, 'update', 'deliverable', None, 'Dependency repair', '',
                         f"Reset {len(fixed)} deliverable(s) blocked by unfinished dependencies")
            return respond(200, {'repaired': fixed, 'count': len(fixed)})

        return respond(405, {'message': 'Method not allowed'})

    except AuthError as e:
        return handle_auth_error(e)
    except Exception as e:
        return respond(500, {'message': str(e)})
