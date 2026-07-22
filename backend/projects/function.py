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


def get_id(event):
    pp = event.get('pathParameters') or {}
    if pp.get('id'):
        return pp['id']
    path = event.get('path', '')
    parts = [p for p in path.split('/') if p and p not in ('api', 'projects')]
    return parts[-1] if parts else None


def handler(event, context):
    try:
        init_db()
        method = event.get('httpMethod', 'GET')
        project_id = get_id(event)
        qp = event.get('queryStringParameters') or {}
        body = json.loads(event['body']) if event.get('body') else {}

        if method == 'OPTIONS':
            return respond(200, {})

        # GET list / single
        if method == 'GET':
            if project_id:
                rows = execute_query("SELECT * FROM projects WHERE id = %s", (project_id,))
                return respond(200, rows[0]) if rows else respond(404, {'message': 'Project not found'})

            conds, params = [], []
            if qp.get('status'):
                conds.append("status = %s")
                params.append(qp['status'])
            if qp.get('search'):
                conds.append("(name ILIKE %s OR description ILIKE %s)")
                params += [f"%{qp['search']}%", f"%{qp['search']}%"]
            where = f"WHERE {' AND '.join(conds)}" if conds else ""
            rows = execute_query(
                f"SELECT * FROM projects {where} ORDER BY created_at DESC",
                params or None
            )
            return respond(200, rows)

        # POST create
        if method == 'POST':
            rows = execute_query("""
                INSERT INTO projects
                    (name, description, status, department, manager,
                     start_date, end_date, budget_planned, priority)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING *
            """, (
                body.get('name', 'Untitled Project'),
                body.get('description', ''),
                body.get('status', 'planning'),
                body.get('department', ''),
                body.get('manager', ''),
                body.get('start_date') or None,
                body.get('end_date') or None,
                float(body.get('budget_planned', 0)),
                body.get('priority', 'medium'),
            ))
            return respond(201, rows[0] if rows else {})

        # PUT update
        if method == 'PUT' and project_id:
            fields = [
                'name', 'description', 'status', 'department', 'manager',
                'start_date', 'end_date', 'budget_planned', 'budget_spent',
                'completion_percentage', 'priority'
            ]
            sets, params = [], []
            for f in fields:
                if f in body:
                    sets.append(f"{f} = %s")
                    val = body[f]
                    if f in ('start_date', 'end_date') and val == '':
                        val = None
                    params.append(val)
            sets.append("updated_at = CURRENT_TIMESTAMP")
            params.append(project_id)
            rows = execute_query(
                f"UPDATE projects SET {', '.join(sets)} WHERE id = %s RETURNING *",
                params
            )
            return respond(200, rows[0] if rows else {})

        # DELETE
        if method == 'DELETE' and project_id:
            execute_query("DELETE FROM projects WHERE id = %s", (project_id,))
            return respond(200, {'message': 'Project deleted successfully'})

        return respond(405, {'message': 'Method not allowed'})

    except Exception as e:
        return respond(500, {'message': str(e)})
