"""PostgreSQL connection + query helper using psycopg3."""
import os
from psycopg import connect
from psycopg.rows import dict_row

PG_CONN = None


def _conninfo():
    is_local = os.environ.get('IS_LOCAL', 'false').lower() == 'true'
    host     = os.environ.get('POSTGRES_HOST') or 'localhost'
    port     = int(os.environ.get('POSTGRES_PORT') or 5432)
    dbname   = os.environ.get('POSTGRES_NAME') or 'postgres'
    user     = os.environ.get('POSTGRES_USER') or 'postgres'
    password = os.environ.get('POSTGRES_PASS') or ''
    parts = [f"host={host}", f"port={port}", f"dbname={dbname}", f"user={user}"]
    if password:
        parts.append(f"password={password}")
    if not is_local:
        parts.append("sslmode=require")
    return " ".join(parts)


def _get_conn():
    global PG_CONN
    if PG_CONN is None or PG_CONN.closed:
        PG_CONN = connect(_conninfo(), row_factory=dict_row, autocommit=True)
    return PG_CONN


def execute_query(query, params=None):
    global PG_CONN
    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute(query, params)
            if cur.description:
                return [dict(r) for r in cur.fetchall()]
            return []
    except Exception as e:
        try:
            if PG_CONN is not None:
                PG_CONN.close()
        except Exception:
            pass
        PG_CONN = None
        print(f"PostgreSQL error: {e}")
        raise
