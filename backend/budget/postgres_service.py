import os
import psycopg2
import psycopg2.extras


def get_connection():
    is_local = os.environ.get('IS_LOCAL', 'false').lower() == 'true'
    kwargs = dict(
        host=os.environ.get('POSTGRES_HOST', 'localhost'),
        port=int(os.environ.get('POSTGRES_PORT', 5432)),
        dbname=os.environ.get('POSTGRES_NAME', 'postgres'),
        user=os.environ.get('POSTGRES_USER', 'postgres'),
        password=os.environ.get('POSTGRES_PASS', 'postgres'),
    )
    if not is_local:
        kwargs['sslmode'] = 'require'
    return psycopg2.connect(**kwargs)


def execute_query(query, params=None):
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params)
            conn.commit()
            try:
                rows = cur.fetchall()
                return [dict(r) for r in rows]
            except psycopg2.ProgrammingError:
                return []
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()