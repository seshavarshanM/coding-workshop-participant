"""
Budget service.

Managers PROPOSE budget for the projects they own. Administrators oversee
but do not set budgets - that is a project-manager responsibility.

Deletions are SOFT: the row is retained with deleted_at / deleted_by so that
financial history stays attributable, and an audit entry is written.
"""
import json
from postgres_service import execute_query
from auth import require_auth, require_role, require_project_owner, \
                 deny_admin_business_action, respond, AuthError, handle_auth_error, is_admin
import audit


def get_method(event):
    return (
        event.get('httpMethod')
        or (event.get('requestContext') or {}).get('http', {}).get('method')
        or 'GET'
    ).upper()


def get_path(event):
    return event.get('path') or event.get('rawPath') or ''


def path_parts(event):
    return [p for p in get_path(event).split('/') if p and p not in ('api', 'budget')]


def init_db():
    execute_query("""
        CREATE TABLE IF NOT EXISTS budget_entries (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id     UUID,
            project_name   VARCHAR(255)  DEFAULT '',
            category       VARCHAR(255)  NOT NULL,
            description    TEXT          DEFAULT '',
            planned_amount DECIMAL(15,2) DEFAULT 0,
            actual_amount  DECIMAL(15,2) DEFAULT 0,
            entry_date     DATE          DEFAULT CURRENT_DATE,
            status         VARCHAR(20)   DEFAULT 'proposed',
            proposed_by    VARCHAR(255)  DEFAULT '',
            deleted_at     TIMESTAMP,
            deleted_by     VARCHAR(255),
            created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # Backfill columns when upgrading an existing table.
    for col, ddl in [
        ('status',      "ALTER TABLE budget_entries ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'proposed'"),
        ('proposed_by', "ALTER TABLE budget_entries ADD COLUMN IF NOT EXISTS proposed_by VARCHAR(255) DEFAULT ''"),
        ('deleted_at',  "ALTER TABLE budget_entries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP"),
        ('deleted_by',  "ALTER TABLE budget_entries ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255)"),
    ]:
        try:
            execute_query(ddl)
        except Exception:
            pass


def fetch_project(project_id):
    rows = execute_query("SELECT * FROM projects WHERE id = %s", (project_id,))
    return rows[0] if rows else None


def fetch_entry(entry_id):
    rows = execute_query("SELECT * FROM budget_entries WHERE id = %s", (entry_id,))
    return rows[0] if rows else None


def handler(event, context):
    method = get_method(event)
    if method == 'OPTIONS':
        return respond(200, {})

    try:
        init_db()
        user = require_auth(event)
        parts = path_parts(event)
        qp = event.get('queryStringParameters') or {}
        body = json.loads(event['body']) if event.get('body') else {}

        # /api/budget/deleted -> removed entries, for oversight
        if method == 'GET' and parts and parts[0] == 'deleted':
            rows = execute_query("""
                SELECT * FROM budget_entries
                WHERE deleted_at IS NOT NULL
                ORDER BY deleted_at DESC
            """)
            return respond(200, rows)

        entry_id = parts[0] if parts and parts[0] != 'deleted' else None

        # ── READ: any authenticated user; soft-deleted rows excluded ──
        if method == 'GET':
            if entry_id:
                entry = fetch_entry(entry_id)
                return respond(200, entry) if entry else respond(404, {'message': 'Entry not found'})

            conds, params = ["deleted_at IS NULL"], []
            if qp.get('project_id'):
                conds.append("project_id = %s::uuid")
                params.append(qp['project_id'])
            if qp.get('category'):
                conds.append("category = %s")
                params.append(qp['category'])
            where = f"WHERE {' AND '.join(conds)}"

            rows = execute_query(
                f"SELECT * FROM budget_entries {where} ORDER BY entry_date DESC", params or None)
            total = execute_query(f"""
                SELECT COALESCE(SUM(planned_amount),0) AS total_planned,
                       COALESCE(SUM(actual_amount),0)  AS total_actual
                FROM budget_entries {where}
            """, params or None)
            return respond(200, {
                'entries': rows,
                'summary': total[0] if total else {'total_planned': 0, 'total_actual': 0},
            })

        # ── CREATE: owning manager proposes budget ────────────────────
        if method == 'POST':
            deny_admin_business_action(user, 'propose project budgets')
            project = fetch_project(body.get('project_id'))
            require_project_owner(user, project, 'add budget to this project')

            rows = execute_query("""
                INSERT INTO budget_entries
                    (project_id, project_name, category, description,
                     planned_amount, actual_amount, entry_date, status, proposed_by)
                VALUES (%s,%s,%s,%s,%s,%s,%s,'proposed',%s)
                RETURNING *
            """, (
                body.get('project_id'),
                project.get('name', ''),
                body.get('category', 'General'),
                body.get('description', ''),
                float(body.get('planned_amount') or 0),
                float(body.get('actual_amount') or 0),
                body.get('entry_date') or None,
                user['name'],
            ))
            created = rows[0] if rows else {}
            audit.record(user, 'propose', 'budget_entry', created.get('id'),
                         f"{created.get('category','')} — ${created.get('planned_amount',0)}",
                         project.get('name', ''))
            return respond(201, created)

        # ── UPDATE: owning manager only ───────────────────────────────
        if method == 'PUT' and entry_id:
            deny_admin_business_action(user, 'modify project budgets')
            entry = fetch_entry(entry_id)
            if not entry:
                return respond(404, {'message': 'Entry not found'})
            project = fetch_project(entry.get('project_id'))
            require_project_owner(user, project, 'modify budget on this project')

            fields = ['category', 'description', 'planned_amount', 'actual_amount',
                      'entry_date', 'status']
            sets, params = [], []
            for f in fields:
                if f in body:
                    sets.append(f"{f} = %s")
                    val = body[f]
                    if f == 'entry_date' and val == '':
                        val = None
                    params.append(val)
            if not sets:
                return respond(400, {'message': 'No fields to update'})
            params.append(entry_id)
            rows = execute_query(
                f"UPDATE budget_entries SET {', '.join(sets)} WHERE id = %s RETURNING *", params)
            audit.record(user, 'update', 'budget_entry', entry_id,
                         f"{entry.get('category','')}", project.get('name', ''))
            return respond(200, rows[0] if rows else {})

        # ── DELETE: owning manager, soft delete + audit ───────────────
        if method == 'DELETE' and entry_id:
            deny_admin_business_action(user, 'delete project budgets')
            entry = fetch_entry(entry_id)
            if not entry:
                return respond(404, {'message': 'Entry not found'})
            project = fetch_project(entry.get('project_id'))
            require_project_owner(user, project, 'delete budget on this project')

            execute_query("""
                UPDATE budget_entries
                SET deleted_at = CURRENT_TIMESTAMP, deleted_by = %s
                WHERE id = %s
            """, (user['name'], entry_id))

            label = f"{entry.get('category','')} — planned ${entry.get('planned_amount',0)}"
            audit.record(user, 'delete', 'budget_entry', entry_id, label,
                         project.get('name', ''),
                         f"Removed by {user['name']} ({user.get('employee_id','')})")
            return respond(200, {
                'message': 'Budget entry removed',
                'deleted_by': user['name'],
                'retained_for_audit': True,
            })

        return respond(405, {'message': 'Method not allowed'})

    except AuthError as e:
        return handle_auth_error(e)
    except Exception as e:
        return respond(500, {'message': str(e)})
