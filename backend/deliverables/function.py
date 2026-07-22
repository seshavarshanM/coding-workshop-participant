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


def get_id(event):
    pp = event.get('pathParameters') or {}
    if pp.get('id'):
        return pp['id']
    path = event.get('path', '')
    parts = [p for p in path.split('/') if p and p not in ('api', 'deliverables')]
    return parts[-1] if parts else None


def handler(event, context):
    try:
        init_db()
        method = event.get('httpMethod', 'GET')
        item_id = get_id(event)
        qp = event.get('queryStringParameters') or {}
        body = json.loads(event['body']) if event.get('body') else {}

        if method == 'OPTIONS':
            return respond(200, {})

        if method == 'GET':
            if item_id:
                rows = execute_query(
                    "SELECT * FROM deliverables WHERE id = %s", (item_id,)
                )
                return respond(200, rows[0]) if rows else respond(404, {'message': 'Not found'})

            conds, params = [], []
            if qp.get('project_id'):
                conds.append("project_id = %s::uuid")
                params.append(qp['project_id'])
            if qp.get('status'):
                conds.append("status = %s")
                params.append(qp['status'])
            if qp.get('search'):
                conds.append("(name ILIKE %s OR description ILIKE %s)")
                params += [f"%{qp['search']}%", f"%{qp['search']}%"]
            where = f"WHERE {' AND '.join(conds)}" if conds else ""
            rows = execute_query(
                f"SELECT * FROM deliverables {where} ORDER BY due_date ASC NULLS LAST",
                params or None
            )
            return respond(200, rows)

        if method == 'POST':
            rows = execute_query("""
                INSERT INTO deliverables
                    (project_id, project_name, name, description, status,
                     due_date, assigned_to, completion_percentage)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING *
            """, (
                body.get('project_id') or None,
                body.get('project_name', ''),
                body.get('name', 'Untitled Deliverable'),
                body.get('description', ''),
                body.get('status', 'pending'),
                body.get('due_date') or None,
                body.get('assigned_to', ''),
                int(body.get('completion_percentage', 0)),
            ))
            return respond(201, rows[0] if rows else {})

        if method == 'PUT' and item_id:
            fields = [
                'project_id', 'project_name', 'name', 'description', 'status',
                'due_date', 'assigned_to', 'completion_percentage'
            ]
            sets, params = [], []
            for f in fields:
                if f in body:
                    sets.append(f"{f} = %s")
                    val = body[f]
                    if f in ('due_date',) and val == '':
                        val = None
                    if f == 'project_id' and val == '':
                        val = None
                    params.append(val)
            sets.append("updated_at = CURRENT_TIMESTAMP")
            params.append(item_id)
            rows = execute_query(
                f"UPDATE deliverables SET {', '.join(sets)} WHERE id = %s RETURNING *",
                params
            )
            return respond(200, rows[0] if rows else {})

        if method == 'DELETE' and item_id:
            execute_query("DELETE FROM deliverables WHERE id = %s", (item_id,))
            return respond(200, {'message': 'Deliverable deleted'})

        return respond(405, {'message': 'Method not allowed'})

    except Exception as e:
        return respond(500, {'message': str(e)})
