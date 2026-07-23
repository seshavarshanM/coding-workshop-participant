"""
Support service — the helpdesk queue.

Anyone who uses the platform can report a problem. Administrators own the
queue: they trage, respond and resolve. This is the administrator's real job in
the system — managers run projects, admins keep the platform working.

Routes (via proxy at /api/support):
  GET    /api/support                list tickets (own tickets, or all for admin)
  GET    /api/support/{id}           single ticket with its replies
  POST   /api/support                raise a ticket
  PUT    /api/support/{id}           update status / priority / assignment (admin)
  POST   /api/support/{id}/replies   add a reply
  GET    /api/support/stats          queue summary
"""
import json
from postgres_service import execute_query
from auth import require_auth, require_role, respond, AuthError, handle_auth_error
import audit

OPEN_STATES = ('open', 'in_progress', 'waiting')


def get_method(event):
    return (
        event.get('httpMethod')
        or (event.get('requestContext') or {}).get('http', {}).get('method')
        or 'GET'
    ).upper()


def get_path(event):
    return event.get('path') or event.get('rawPath') or ''


def path_parts(event):
    return [p for p in get_path(event).split('/') if p and p not in ('api', 'support')]


def init_db():
    execute_query("""
        CREATE TABLE IF NOT EXISTS support_tickets (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            reference     VARCHAR(20)  UNIQUE,
            subject       VARCHAR(255) NOT NULL,
            description   TEXT         DEFAULT '',
            category      VARCHAR(50)  DEFAULT 'other',
            priority      VARCHAR(20)  DEFAULT 'normal',
            status        VARCHAR(20)  DEFAULT 'open',
            raised_by     VARCHAR(255) DEFAULT '',
            raised_by_id  UUID,
            raised_by_role VARCHAR(20) DEFAULT '',
            project_name  VARCHAR(255) DEFAULT '',
            assigned_to   VARCHAR(255) DEFAULT '',
            resolution    TEXT         DEFAULT '',
            created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            resolved_at   TIMESTAMP
        )
    """)
    execute_query("""
        CREATE TABLE IF NOT EXISTS support_replies (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            ticket_id   UUID NOT NULL,
            author_name VARCHAR(255) DEFAULT '',
            author_role VARCHAR(20)  DEFAULT '',
            message     TEXT         NOT NULL,
            created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
    """)


def next_reference():
    rows = execute_query(
        "SELECT reference FROM support_tickets WHERE reference LIKE 'TKT-%'"
        " ORDER BY created_at DESC LIMIT 1")
    if not rows or not rows[0]['reference']:
        return 'TKT-1001'
    try:
        return f"TKT-{int(rows[0]['reference'].split('-')[1]) + 1}"
    except Exception:
        return 'TKT-1001'


def fetch_ticket(ticket_id):
    rows = execute_query("SELECT * FROM support_tickets WHERE id = %s::uuid", (ticket_id,))
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

        is_admin = user['role'] == 'admin'

        # ── Queue summary ─────────────────────────────────────────────
        if method == 'GET' and parts and parts[0] == 'stats':
            scope = "" if is_admin else "WHERE raised_by = %s"
            params = None if is_admin else (user['name'],)
            rows = execute_query(f"""
                SELECT status, COUNT(*) AS count FROM support_tickets {scope}
                GROUP BY status
            """, params)
            counts = {r['status']: int(r['count']) for r in rows}
            return respond(200, {
                'counts': counts,
                'open': sum(counts.get(s, 0) for s in OPEN_STATES),
                'total': sum(counts.values()),
            })

        ticket_id = parts[0] if parts and parts[0] != 'stats' else None
        wants_replies = len(parts) >= 2 and parts[1] == 'replies'

        # ── Replies ───────────────────────────────────────────────────
        if wants_replies:
            ticket = fetch_ticket(ticket_id)
            if not ticket:
                return respond(404, {'message': 'Ticket not found'})
            # People see their own tickets; admins see everything.
            if not is_admin and ticket['raised_by'] != user['name']:
                raise AuthError(403, 'You can only view your own tickets')

            if method == 'GET':
                return respond(200, execute_query(
                    "SELECT * FROM support_replies WHERE ticket_id = %s::uuid"
                    " ORDER BY created_at ASC", (ticket_id,)))

            if method == 'POST':
                message = (body.get('message') or '').strip()
                if not message:
                    return respond(400, {'message': 'A message is required'})
                execute_query("""
                    INSERT INTO support_replies (ticket_id, author_name, author_role, message)
                    VALUES (%s::uuid,%s,%s,%s)
                """, (ticket_id, user['name'], user['role'], message))
                # A reply from support moves a new ticket into progress.
                if is_admin and ticket['status'] == 'open':
                    execute_query(
                        "UPDATE support_tickets SET status='in_progress',"
                        " assigned_to=%s, updated_at=CURRENT_TIMESTAMP WHERE id=%s::uuid",
                        (user['name'], ticket_id))
                execute_query(
                    "UPDATE support_tickets SET updated_at=CURRENT_TIMESTAMP WHERE id=%s::uuid",
                    (ticket_id,))
                return respond(201, {'message': 'Reply added'})

        # ── Read tickets ──────────────────────────────────────────────
        if method == 'GET':
            if ticket_id:
                ticket = fetch_ticket(ticket_id)
                if not ticket:
                    return respond(404, {'message': 'Ticket not found'})
                if not is_admin and ticket['raised_by'] != user['name']:
                    raise AuthError(403, 'You can only view your own tickets')
                return respond(200, ticket)

            conds, params = [], []
            if not is_admin:
                conds.append("raised_by = %s")
                params.append(user['name'])
            if qp.get('status') == 'open':
                conds.append("status IN ('open','in_progress','waiting')")
            elif qp.get('status'):
                conds.append("status = %s")
                params.append(qp['status'])
            if qp.get('category'):
                conds.append("category = %s")
                params.append(qp['category'])
            where = f"WHERE {' AND '.join(conds)}" if conds else ""
            return respond(200, execute_query(f"""
                SELECT * FROM support_tickets {where}
                ORDER BY
                    CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1
                                WHEN 'waiting' THEN 2 ELSE 3 END,
                    CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1
                                  WHEN 'normal' THEN 2 ELSE 3 END,
                    created_at DESC
            """, params or None))

        # ── Raise a ticket — anyone signed in ─────────────────────────
        if method == 'POST' and not ticket_id:
            subject = (body.get('subject') or '').strip()
            if not subject:
                return respond(400, {'message': 'A subject is required'})
            reference = next_reference()
            rows = execute_query("""
                INSERT INTO support_tickets
                    (reference, subject, description, category, priority,
                     raised_by, raised_by_id, raised_by_role, project_name)
                VALUES (%s,%s,%s,%s,%s,%s,%s::uuid,%s,%s)
                RETURNING *
            """, (
                reference, subject, body.get('description', ''),
                body.get('category', 'other'), body.get('priority', 'normal'),
                user['name'], user['id'], user['role'], body.get('project_name', ''),
            ))
            created = rows[0] if rows else {}
            audit.record(user, 'create', 'ticket', created.get('id'),
                         f"{reference} — {subject}", body.get('project_name', ''))
            return respond(201, created)

        # ── Triage — administrators own the queue ─────────────────────
        if method == 'PUT' and ticket_id:
            require_role(user, 'admin')
            ticket = fetch_ticket(ticket_id)
            if not ticket:
                return respond(404, {'message': 'Ticket not found'})

            fields = ['status', 'priority', 'category', 'assigned_to', 'resolution']
            sets, params = [], []
            for f in fields:
                if f in body:
                    sets.append(f"{f} = %s")
                    params.append(body[f])
            if not sets:
                return respond(400, {'message': 'No fields to update'})
            if body.get('status') in ('resolved', 'closed'):
                sets.append("resolved_at = CURRENT_TIMESTAMP")
            sets.append("updated_at = CURRENT_TIMESTAMP")
            params.append(ticket_id)
            rows = execute_query(
                f"UPDATE support_tickets SET {', '.join(sets)} WHERE id = %s::uuid RETURNING *",
                params)
            audit.record(user, 'update', 'ticket', ticket_id,
                         f"{ticket['reference']} → {body.get('status', ticket['status'])}",
                         ticket.get('project_name', ''))
            return respond(200, rows[0] if rows else {})

        return respond(405, {'message': 'Method not allowed'})

    except AuthError as e:
        return handle_auth_error(e)
    except Exception as e:
        return respond(500, {'message': str(e)})
