import json
from postgres_service import execute_query

HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
}


def respond(status, body):
    return {'statusCode': status, 'headers': HEADERS, 'body': json.dumps(body, default=str)}


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
    path = get_path(event)
    parts = [p for p in path.split('/') if p and p not in ('api', 'resources')]
    return parts[-1] if parts else None


def init_db():
    execute_query("""
        CREATE TABLE IF NOT EXISTS resources (
            id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name             VARCHAR(255) NOT NULL,
            email            VARCHAR(255) DEFAULT '',
            role             VARCHAR(255) DEFAULT '',
            department       VARCHAR(255) DEFAULT '',
            capacity_hours   INTEGER      DEFAULT 40,
            allocated_hours  INTEGER      DEFAULT 0,
            projects         TEXT         DEFAULT '',
            created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            updated_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
    """)


def handler(event, context):
    try:
        init_db()
        method = get_method(event)
        item_id = get_id(event)
        qp = event.get('queryStringParameters') or {}
        body = json.loads(event['body']) if event.get('body') else {}

        if method == 'OPTIONS':
            return respond(200, {})

        if method == 'GET':
            if item_id:
                rows = execute_query("SELECT * FROM resources WHERE id = %s", (item_id,))
                return respond(200, rows[0]) if rows else respond(404, {'message': 'Not found'})

            conds, params = [], []
            if qp.get('department'):
                conds.append("department = %s")
                params.append(qp['department'])
            if qp.get('search'):
                conds.append("(name ILIKE %s OR email ILIKE %s OR role ILIKE %s)")
                s = f"%{qp['search']}%"
                params += [s, s, s]
            where = f"WHERE {' AND '.join(conds)}" if conds else ""
            rows = execute_query(
                f"SELECT * FROM resources {where} ORDER BY name ASC",
                params or None
            )
            return respond(200, rows)

        if method == 'POST':
            rows = execute_query("""
                INSERT INTO resources
                    (name, email, role, department, capacity_hours, allocated_hours, projects)
                VALUES (%s,%s,%s,%s,%s,%s,%s)
                RETURNING *
            """, (
                body.get('name', 'Team Member'),
                body.get('email', ''),
                body.get('role', ''),
                body.get('department', ''),
                int(body.get('capacity_hours') or 40),
                int(body.get('allocated_hours') or 0),
                body.get('projects', ''),
            ))
            return respond(201, rows[0] if rows else {})

        if method == 'PUT' and item_id:
            fields = ['name', 'email', 'role', 'department', 'capacity_hours', 'allocated_hours', 'projects']
            sets, params = [], []
            for f in fields:
                if f in body:
                    sets.append(f"{f} = %s")
                    params.append(body[f])
            sets.append("updated_at = CURRENT_TIMESTAMP")
            params.append(item_id)
            rows = execute_query(
                f"UPDATE resources SET {', '.join(sets)} WHERE id = %s RETURNING *",
                params
            )
            return respond(200, rows[0] if rows else {})

        if method == 'DELETE' and item_id:
            execute_query("DELETE FROM resources WHERE id = %s", (item_id,))
            return respond(200, {'message': 'Resource deleted'})

        return respond(405, {'message': 'Method not allowed'})

    except Exception as e:
        return respond(500, {'message': str(e)})