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
        CREATE TABLE IF NOT EXISTS budget_entries (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id     UUID,
            project_name   VARCHAR(255)  DEFAULT '',
            category       VARCHAR(255)  NOT NULL,
            description    TEXT          DEFAULT '',
            planned_amount DECIMAL(15,2) DEFAULT 0,
            actual_amount  DECIMAL(15,2) DEFAULT 0,
            entry_date     DATE          DEFAULT CURRENT_DATE,
            created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
        )
    """)


def get_id(event):
    pp = event.get('pathParameters') or {}
    if pp.get('id'):
        return pp['id']
    path = event.get('path', '')
    parts = [p for p in path.split('/') if p and p not in ('api', 'budget')]
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
                    "SELECT * FROM budget_entries WHERE id = %s", (item_id,)
                )
                return respond(200, rows[0]) if rows else respond(404, {'message': 'Not found'})

            conds, params = [], []
            if qp.get('project_id'):
                conds.append("project_id = %s::uuid")
                params.append(qp['project_id'])
            if qp.get('category'):
                conds.append("category = %s")
                params.append(qp['category'])
            where = f"WHERE {' AND '.join(conds)}" if conds else ""

            rows = execute_query(
                f"SELECT * FROM budget_entries {where} ORDER BY entry_date DESC",
                params or None
            )

            # Append summary totals
            total = execute_query(f"""
                SELECT
                    COALESCE(SUM(planned_amount),0) AS total_planned,
                    COALESCE(SUM(actual_amount),0)  AS total_actual
                FROM budget_entries {where}
            """, params or None)

            return respond(200, {
                'entries': rows,
                'summary': total[0] if total else {'total_planned': 0, 'total_actual': 0}
            })

        if method == 'POST':
            rows = execute_query("""
                INSERT INTO budget_entries
                    (project_id, project_name, category, description,
                     planned_amount, actual_amount, entry_date)
                VALUES (%s,%s,%s,%s,%s,%s,%s)
                RETURNING *
            """, (
                body.get('project_id') or None,
                body.get('project_name', ''),
                body.get('category', 'General'),
                body.get('description', ''),
                float(body.get('planned_amount', 0)),
                float(body.get('actual_amount', 0)),
                body.get('entry_date') or None,
            ))
            return respond(201, rows[0] if rows else {})

        if method == 'PUT' and item_id:
            fields = ['project_id', 'project_name', 'category', 'description',
                      'planned_amount', 'actual_amount', 'entry_date']
            sets, params = [], []
            for f in fields:
                if f in body:
                    sets.append(f"{f} = %s")
                    val = body[f]
                    if f in ('entry_date', 'project_id') and val == '':
                        val = None
                    params.append(val)
            params.append(item_id)
            rows = execute_query(
                f"UPDATE budget_entries SET {', '.join(sets)} WHERE id = %s RETURNING *",
                params
            )
            return respond(200, rows[0] if rows else {})

        if method == 'DELETE' and item_id:
            execute_query("DELETE FROM budget_entries WHERE id = %s", (item_id,))
            return respond(200, {'message': 'Entry deleted'})

        return respond(405, {'message': 'Method not allowed'})

    except Exception as e:
        return respond(500, {'message': str(e)})