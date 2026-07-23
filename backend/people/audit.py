"""
Audit trail — records who did what, and when.

Deletions and budget changes are recorded so that actions on financial and
project records are always attributable. This answers questions like
"who removed this budget entry, and when?" without relying on memory.
"""
from postgres_service import execute_query


def init_audit_table():
    execute_query("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            actor_id      UUID,
            actor_name    VARCHAR(255) DEFAULT '',
            actor_role    VARCHAR(20)  DEFAULT '',
            action        VARCHAR(50)  NOT NULL,
            entity_type   VARCHAR(50)  NOT NULL,
            entity_id     UUID,
            entity_label  VARCHAR(255) DEFAULT '',
            project_name  VARCHAR(255) DEFAULT '',
            details       TEXT         DEFAULT '',
            created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
    """)


def record(user, action, entity_type, entity_id=None, entity_label='', project_name='', details=''):
    """
    Write an audit entry. Never raises — auditing must not break the operation
    it is recording, but failures are printed so they surface in logs.
    """
    try:
        init_audit_table()
        execute_query("""
            INSERT INTO audit_log
                (actor_id, actor_name, actor_role, action, entity_type,
                 entity_id, entity_label, project_name, details)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            user.get('id'),
            user.get('name', ''),
            user.get('role', ''),
            action,
            entity_type,
            entity_id,
            entity_label,
            project_name,
            details,
        ))
    except Exception as e:
        print(f"Audit write failed ({action} {entity_type}): {e}")


def list_entries(limit=200, entity_type=None, actor_name=None):
    init_audit_table()
    conds, params = [], []
    if entity_type:
        conds.append("entity_type = %s")
        params.append(entity_type)
    if actor_name:
        conds.append("actor_name = %s")
        params.append(actor_name)
    where = f"WHERE {' AND '.join(conds)}" if conds else ""
    params.append(limit)
    return execute_query(
        f"SELECT * FROM audit_log {where} ORDER BY created_at DESC LIMIT %s",
        params
    )
