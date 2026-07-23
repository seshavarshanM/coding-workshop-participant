"""
People service — unified identity for ACME Project Hub.

One `people` record = one human. Used for:
  - login (bcrypt-hashed password + JWT session token)
  - resource allocation (capacity / allocated hours)
  - assignee & manager references across projects and deliverables

Routes (via proxy at /api/people):
  GET    /api/people                 list all (never returns password_hash)
  GET    /api/people/{id}            single person
  POST   /api/people                 create person (hashes password)
  PUT    /api/people/{id}            update person
  DELETE /api/people/{id}            remove person
  POST   /api/people/login           { email, password } -> { token, user }
  POST   /api/people/seed            populate demo data (idempotent)
"""
import json
import os
import datetime
import bcrypt
import jwt
from postgres_service import execute_query
from auth import require_auth, require_role, deny_admin_business_action, \
                 AuthError, handle_auth_error
import audit

HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
}

# In production this would come from AWS Secrets Manager, never a literal.
JWT_SECRET = os.environ.get('JWT_SECRET', 'acme-workshop-dev-secret-change-in-prod')
JWT_ALGO = 'HS256'
TOKEN_HOURS = 8

PUBLIC_FIELDS = """
    id, employee_id, name, email, role, title, department,
    capacity_hours, allocated_hours, projects, phone, location,
    bio, joined_date, created_at, updated_at
"""


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


def path_parts(event):
    """Segments after /api/people — e.g. ['login'] or ['<uuid>']."""
    path = get_path(event)
    return [p for p in path.split('/') if p and p not in ('api', 'people')]


# ── Password hashing (bcrypt: one-way, salt embedded in the hash) ──────────
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode('utf-8'), bcrypt.gensalt(rounds=12)).decode('utf-8')


def verify_password(plain: str, stored_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode('utf-8'), stored_hash.encode('utf-8'))
    except Exception:
        return False


def make_token(person):
    payload = {
        'sub': str(person['id']),
        'employee_id': person.get('employee_id'),
        'email': person['email'],
        'role': person['role'],
        'name': person['name'],
        'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=TOKEN_HOURS),
        'iat': datetime.datetime.now(datetime.timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def init_db():
    execute_query("""
        CREATE TABLE IF NOT EXISTS people (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            employee_id     VARCHAR(20)  UNIQUE NOT NULL,
            name            VARCHAR(255) NOT NULL,
            email           VARCHAR(255) UNIQUE NOT NULL,
            password_hash   TEXT         NOT NULL,
            role            VARCHAR(20)  NOT NULL DEFAULT 'member',
            title           VARCHAR(255) DEFAULT '',
            department      VARCHAR(255) DEFAULT '',
            capacity_hours  INTEGER      DEFAULT 40,
            allocated_hours INTEGER      DEFAULT 0,
            projects        TEXT         DEFAULT '',
            phone           VARCHAR(50)  DEFAULT '',
            location        VARCHAR(255) DEFAULT '',
            bio             TEXT         DEFAULT '',
            joined_date     DATE,
            created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
    """)


def handler(event, context):
    method = get_method(event)
    if method == 'OPTIONS':
        return respond(200, {})

    try:
        init_db()
        parts = path_parts(event)
        qp = event.get('queryStringParameters') or {}
        body = json.loads(event['body']) if event.get('body') else {}

        # ── POST /api/people/login ────────────────────────────────────────
        if method == 'POST' and parts and parts[0] == 'login':
            email = (body.get('email') or '').strip().lower()
            password = body.get('password') or ''
            if not email or not password:
                return respond(400, {'message': 'Email and password are required'})

            rows = execute_query(
                "SELECT * FROM people WHERE LOWER(email) = %s", (email,)
            )
            if not rows or not verify_password(password, rows[0]['password_hash']):
                # Same message either way — don't reveal which part was wrong.
                return respond(401, {'message': 'Invalid email or password'})

            person = rows[0]
            person.pop('password_hash', None)
            return respond(200, {'token': make_token(person), 'user': person})

        # ── POST /api/people/seed ─────────────────────────────────────────
        if method == 'POST' and parts and parts[0] == 'seed':
            return respond(200, seed_demo_data())

        # Everything past this point requires a valid session.
        user = require_auth(event)

        # ── GET /api/people/audit — activity trail ────────────────────────
        # Admins see everything; managers see their own actions.
        if method == 'GET' and parts and parts[0] == 'audit':
            require_role(user, 'admin', 'manager')
            actor = None if user['role'] == 'admin' else user['name']
            entries = audit.list_entries(
                limit=int(qp.get('limit') or 200),
                entity_type=qp.get('entity_type'),
                actor_name=qp.get('actor') or actor,
            )
            return respond(200, entries)
        person_id = parts[0] if parts and parts[0] not in ('login', 'seed', 'audit') else None

        # ── GET ───────────────────────────────────────────────────────────
        if method == 'GET':
            if person_id:
                rows = execute_query(
                    f"SELECT {PUBLIC_FIELDS} FROM people WHERE id = %s", (person_id,)
                )
                return respond(200, rows[0]) if rows else respond(404, {'message': 'Person not found'})

            conds, params = [], []
            if qp.get('role'):
                conds.append("role = %s")
                params.append(qp['role'])
            if qp.get('department'):
                conds.append("department = %s")
                params.append(qp['department'])
            if qp.get('search'):
                conds.append("(name ILIKE %s OR email ILIKE %s OR title ILIKE %s OR employee_id ILIKE %s)")
                s = f"%{qp['search']}%"
                params += [s, s, s, s]
            where = f"WHERE {' AND '.join(conds)}" if conds else ""
            rows = execute_query(
                f"SELECT {PUBLIC_FIELDS} FROM people {where} ORDER BY name ASC",
                params or None
            )
            return respond(200, rows)

        # ── POST create — managers hire; admins may onboard accounts ──────
        if method == 'POST':
            require_role(user, 'manager', 'admin')
            if not body.get('email') or not body.get('name'):
                return respond(400, {'message': 'Name and email are required'})
            # Only admins may mint another admin.
            if body.get('role') == 'admin' and user['role'] != 'admin':
                return respond(403, {'message': 'Only an administrator can create an admin account'})
            password = body.get('password') or 'Welcome@123'
            emp_id = body.get('employee_id') or next_employee_id()
            rows = execute_query(f"""
                INSERT INTO people
                    (employee_id, name, email, password_hash, role, title, department,
                     capacity_hours, allocated_hours, projects, phone, location, bio, joined_date)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING {PUBLIC_FIELDS}
            """, (
                emp_id,
                body.get('name'),
                body.get('email').strip().lower(),
                hash_password(password),
                body.get('role', 'member'),
                body.get('title', ''),
                body.get('department', ''),
                int(body.get('capacity_hours') or 40),
                int(body.get('allocated_hours') or 0),
                body.get('projects', ''),
                body.get('phone', ''),
                body.get('location', ''),
                body.get('bio', ''),
                body.get('joined_date') or None,
            ))
            created = rows[0] if rows else {}
            audit.record(user, 'hire', 'person', created.get('id'),
                         f"{created.get('name','')} ({created.get('employee_id','')})", '',
                         f"Onboarded as {created.get('role','member')}")
            return respond(201, created)

        # ── PUT update — self, or manager/admin ───────────────────────────
        if method == 'PUT' and person_id:
            if str(user['id']) != str(person_id) and user['role'] not in ('manager', 'admin'):
                raise AuthError(403, 'You can only edit your own profile')
            # Role changes are an administrator action.
            if 'role' in body and user['role'] != 'admin':
                return respond(403, {'message': 'Only an administrator can change a role'})
            fields = ['name', 'email', 'role', 'title', 'department', 'capacity_hours',
                      'allocated_hours', 'projects', 'phone', 'location', 'bio', 'joined_date']
            sets, params = [], []
            for f in fields:
                if f in body:
                    sets.append(f"{f} = %s")
                    val = body[f]
                    if f == 'joined_date' and val == '':
                        val = None
                    params.append(val)
            # Password change is handled separately so it always gets hashed.
            if body.get('password'):
                sets.append("password_hash = %s")
                params.append(hash_password(body['password']))
            if not sets:
                return respond(400, {'message': 'No fields to update'})
            sets.append("updated_at = CURRENT_TIMESTAMP")
            params.append(person_id)
            rows = execute_query(
                f"UPDATE people SET {', '.join(sets)} WHERE id = %s RETURNING {PUBLIC_FIELDS}",
                params
            )
            return respond(200, rows[0] if rows else {})

        # ── DELETE — administrator only (account administration) ──────────
        if method == 'DELETE' and person_id:
            require_role(user, 'admin')
            existing = execute_query("SELECT name, employee_id FROM people WHERE id = %s", (person_id,))
            execute_query("DELETE FROM people WHERE id = %s", (person_id,))
            if existing:
                audit.record(user, 'delete', 'person', person_id,
                             f"{existing[0]['name']} ({existing[0]['employee_id']})", '',
                             'Account removed by administrator')
            return respond(200, {'message': 'Person removed'})

        return respond(405, {'message': 'Method not allowed'})

    except AuthError as e:
        return handle_auth_error(e)
    except Exception as e:
        return respond(500, {'message': str(e)})


def next_employee_id():
    rows = execute_query(
        "SELECT employee_id FROM people WHERE employee_id LIKE 'ACME-%' ORDER BY employee_id DESC LIMIT 1"
    )
    if not rows:
        return 'ACME-1001'
    try:
        return f"ACME-{int(rows[0]['employee_id'].split('-')[1]) + 1}"
    except Exception:
        return 'ACME-1001'


# ── Demo seed ─────────────────────────────────────────────────────────────
DEMO_PEOPLE = [
    # (emp_id, name, email, password, role, title, dept, capacity, phone, location, bio, joined)
    ('ACME-1001', 'Alice Fernandes', 'alice.admin@acme.com', 'Admin@123', 'admin',
     'Head of PMO', 'Operations', 40, '+91 98400 11001', 'Chennai, IN',
     'Oversees portfolio governance, budgets and resourcing across all departments.', '2021-03-15'),
    ('ACME-1002', 'Michael Rao', 'michael.rao@acme.com', 'Manager@123', 'manager',
     'Engineering Manager', 'Engineering', 40, '+91 98400 11002', 'Bengaluru, IN',
     'Leads platform engineering projects and delivery planning.', '2022-01-10'),
    ('ACME-1003', 'Priya Nair', 'priya.nair@acme.com', 'Manager@123', 'manager',
     'Product Delivery Manager', 'Product', 40, '+91 98400 11003', 'Chennai, IN',
     'Owns customer-facing product initiatives end to end.', '2022-07-04'),
    ('ACME-1004', 'Daniel Okafor', 'daniel.okafor@acme.com', 'Manager@123', 'manager',
     'Infrastructure Manager', 'IT Infrastructure', 40, '+91 98400 11004', 'Hyderabad, IN',
     'Responsible for cloud migration and internal platform reliability.', '2021-11-22'),
    ('ACME-1005', 'Sana Kapoor', 'sana.kapoor@acme.com', 'Member@123', 'member',
     'Senior Backend Engineer', 'Engineering', 40, '+91 98400 11005', 'Bengaluru, IN',
     'Builds APIs and data services; focuses on Java and Python backends.', '2023-02-13'),
    ('ACME-1006', 'Rahul Menon', 'rahul.menon@acme.com', 'Member@123', 'member',
     'Frontend Engineer', 'Engineering', 40, '+91 98400 11006', 'Chennai, IN',
     'React and design-system work across internal tools.', '2023-06-01'),
    ('ACME-1007', 'Grace Liu', 'grace.liu@acme.com', 'Member@123', 'member',
     'QA Engineer', 'Quality', 40, '+91 98400 11007', 'Pune, IN',
     'Test automation and release verification.', '2023-09-18'),
    ('ACME-1008', 'Omar Haddad', 'omar.haddad@acme.com', 'Member@123', 'member',
     'DevOps Engineer', 'IT Infrastructure', 40, '+91 98400 11008', 'Hyderabad, IN',
     'CI/CD pipelines, Terraform and AWS operations.', '2022-10-05'),
    ('ACME-1009', 'Lena Fischer', 'lena.fischer@acme.com', 'Member@123', 'member',
     'UX Designer', 'Product', 40, '+91 98400 11009', 'Chennai, IN',
     'Interaction design and usability research.', '2024-01-08'),
    ('ACME-1010', 'Arjun Pillai', 'arjun.pillai@acme.com', 'Member@123', 'member',
     'Data Analyst', 'Product', 40, '+91 98400 11010', 'Bengaluru, IN',
     'Reporting, dashboards and delivery metrics.', '2024-04-29'),
]


def seed_demo_data():
    """Insert demo people if they don't already exist. Safe to run repeatedly."""
    created, skipped = [], []
    for (emp, name, email, pwd, role, title, dept, cap, phone, loc, bio, joined) in DEMO_PEOPLE:
        existing = execute_query("SELECT id FROM people WHERE LOWER(email) = %s", (email.lower(),))
        if existing:
            skipped.append(email)
            continue
        execute_query("""
            INSERT INTO people
                (employee_id, name, email, password_hash, role, title, department,
                 capacity_hours, allocated_hours, projects, phone, location, bio, joined_date)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,0,'',%s,%s,%s,%s)
        """, (emp, name, email.lower(), hash_password(pwd), role, title, dept, cap,
              phone, loc, bio, joined))
        created.append(email)
    proj_result = seed_projects_and_work()
    return {
        'people_created': created,
        'people_skipped': skipped,
        'work': proj_result,
        'message': f'{len(created)} people created, {len(skipped)} already existed. {proj_result["message"]}'
    }


# ── Projects / deliverables / budget seed ─────────────────────────────────
# Dates are relative to "today" so the at-risk detection always has something
# meaningful to flag during a demo.
def _d(offset_days):
    return (datetime.date.today() + datetime.timedelta(days=offset_days)).isoformat()


DEMO_PROJECTS = [
    # name, description, status, dept, manager, start, end, budget, priority
    ('Customer Portal Redesign',
     'Rebuild the self-service customer portal with a new design system and improved accessibility.',
     'active', 'Product', 'Priya Nair', _d(-60), _d(35), 120000, 'high'),
    ('Payments API v2',
     'Second-generation payments API with idempotency, richer webhooks and partner sandbox.',
     'active', 'Engineering', 'Michael Rao', _d(-90), _d(9), 250000, 'critical'),
    ('Cloud Migration Phase 2',
     'Migrate remaining on-premise workloads to AWS, including database and batch processing.',
     'at_risk', 'IT Infrastructure', 'Daniel Okafor', _d(-120), _d(-5), 300000, 'high'),
    ('Internal Analytics Dashboard',
     'Unified delivery metrics dashboard for portfolio reporting to leadership.',
     'planning', 'Product', 'Priya Nair', _d(14), _d(120), 80000, 'medium'),
    ('Legacy CRM Decommission',
     'Retire the legacy CRM after data archival and downstream consumer migration.',
     'on_hold', 'IT Infrastructure', 'Daniel Okafor', _d(-30), _d(150), 60000, 'low'),
    ('Mobile App Launch',
     'Public launch of the ACME companion mobile app on iOS and Android.',
     'completed', 'Engineering', 'Michael Rao', _d(-210), _d(-20), 180000, 'high'),
]

# project name -> list of (deliverable name, description, status, pct, assignee, due, depends_on_name)
DEMO_DELIVERABLES = {
    'Customer Portal Redesign': [
        ('Design system foundations', 'Typography, colour and component tokens.', 'completed', 100, 'Lena Fischer', _d(-40), None),
        ('Portal UI build', 'Implement redesigned screens in React.', 'in_progress', 65, 'Rahul Menon', _d(20), 'Design system foundations'),
        ('Accessibility audit', 'WCAG 2.1 AA review and remediation.', 'pending', 0, 'Grace Liu', _d(30), 'Portal UI build'),
    ],
    'Payments API v2': [
        ('API contract specification', 'OpenAPI spec agreed with partner teams.', 'completed', 100, 'Sana Kapoor', _d(-70), None),
        ('Core payments service', 'Idempotent payment processing endpoints.', 'in_progress', 55, 'Sana Kapoor', _d(5), 'API contract specification'),
        ('Partner sandbox', 'Sandbox environment for partner integration testing.', 'pending', 0, 'Omar Haddad', _d(8), 'Core payments service'),
        ('Load and soak testing', 'Verify throughput and stability targets.', 'blocked', 10, 'Grace Liu', _d(7), 'Core payments service'),
    ],
    'Cloud Migration Phase 2': [
        ('Database migration plan', 'Cutover approach, rollback and downtime window.', 'completed', 100, 'Omar Haddad', _d(-80), None),
        ('Batch workload migration', 'Move nightly batch jobs to managed services.', 'in_progress', 40, 'Omar Haddad', _d(-2), 'Database migration plan'),
        ('Production cutover', 'Final switchover and decommission of old hosts.', 'blocked', 0, 'Omar Haddad', _d(10), 'Batch workload migration'),
    ],
    'Internal Analytics Dashboard': [
        ('Metric definitions', 'Agree portfolio metrics and calculation rules.', 'in_progress', 30, 'Arjun Pillai', _d(25), None),
        ('Data pipeline', 'Ingest project data into the reporting store.', 'pending', 0, 'Arjun Pillai', _d(60), 'Metric definitions'),
    ],
    'Legacy CRM Decommission': [
        ('Data archival', 'Archive historical CRM records to cold storage.', 'pending', 0, 'Omar Haddad', _d(90), None),
    ],
    'Mobile App Launch': [
        ('Beta release', 'TestFlight and Play Console beta rollout.', 'completed', 100, 'Rahul Menon', _d(-60), None),
        ('Store submission', 'App store review and approval.', 'completed', 100, 'Rahul Menon', _d(-30), 'Beta release'),
        ('Launch retrospective', 'Post-launch review and lessons learned.', 'completed', 100, 'Grace Liu', _d(-18), 'Store submission'),
    ],
}

# project name -> list of (category, description, planned, actual, date offset)
DEMO_BUDGET = {
    'Customer Portal Redesign': [
        ('Personnel', 'Design and frontend engineering effort', 70000, 52000, -30),
        ('Tooling', 'Design system and testing tools', 15000, 12500, -25),
        ('Vendor', 'Accessibility consultancy', 20000, 0, -5),
    ],
    'Payments API v2': [
        ('Personnel', 'Backend engineering effort', 150000, 138000, -45),
        ('Infrastructure', 'Sandbox and load-test environments', 45000, 51000, -20),
        ('Vendor', 'Payment gateway certification', 30000, 30000, -60),
    ],
    'Cloud Migration Phase 2': [
        ('Infrastructure', 'AWS compute and storage during migration', 180000, 205000, -50),
        ('Personnel', 'DevOps engineering effort', 90000, 88000, -40),
        ('Training', 'Team AWS certification', 12000, 9000, -70),
    ],
    'Internal Analytics Dashboard': [
        ('Personnel', 'Analyst and engineering effort', 55000, 4000, -3),
    ],
    'Legacy CRM Decommission': [
        ('Operations', 'Archival storage and tooling', 25000, 0, -10),
    ],
    'Mobile App Launch': [
        ('Personnel', 'Mobile engineering effort', 120000, 118000, -120),
        ('Marketing', 'Launch campaign', 40000, 44000, -40),
    ],
}


def seed_projects_and_work():
    """Seed projects, their deliverables (with dependencies) and budget entries."""
    # Ensure the sibling tables exist before inserting into them.
    execute_query("""
        CREATE TABLE IF NOT EXISTS projects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL, description TEXT DEFAULT '',
            status VARCHAR(50) DEFAULT 'planning', department VARCHAR(255) DEFAULT '',
            manager VARCHAR(255) DEFAULT '', start_date DATE, end_date DATE,
            budget_planned DECIMAL(15,2) DEFAULT 0, budget_spent DECIMAL(15,2) DEFAULT 0,
            completion_percentage INTEGER DEFAULT 0, priority VARCHAR(50) DEFAULT 'medium',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
    """)
    execute_query("""
        CREATE TABLE IF NOT EXISTS deliverables (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID,
            project_name VARCHAR(255) DEFAULT '', name VARCHAR(255) NOT NULL,
            description TEXT DEFAULT '', status VARCHAR(50) DEFAULT 'pending',
            due_date DATE, assigned_to VARCHAR(255) DEFAULT '', depends_on UUID,
            completion_percentage INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
    """)
    execute_query("""
        CREATE TABLE IF NOT EXISTS budget_entries (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID,
            project_name VARCHAR(255) DEFAULT '', category VARCHAR(255) NOT NULL,
            description TEXT DEFAULT '', planned_amount DECIMAL(15,2) DEFAULT 0,
            actual_amount DECIMAL(15,2) DEFAULT 0, entry_date DATE DEFAULT CURRENT_DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
    """)

    projects_created, deliverables_created, budget_created = 0, 0, 0

    for (name, desc, status, dept, mgr, start, end, budget, prio) in DEMO_PROJECTS:
        existing = execute_query("SELECT id FROM projects WHERE name = %s", (name,))
        if existing:
            project_id = existing[0]['id']
        else:
            rows = execute_query("""
                INSERT INTO projects
                    (name, description, status, department, manager, start_date, end_date,
                     budget_planned, priority)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
            """, (name, desc, status, dept, mgr, start, end, budget, prio))
            project_id = rows[0]['id']
            projects_created += 1

        # Deliverables — insert in order so dependencies can be resolved by name.
        name_to_id = {}
        for (dname, ddesc, dstatus, dpct, assignee, due, depends) in DEMO_DELIVERABLES.get(name, []):
            found = execute_query(
                "SELECT id FROM deliverables WHERE name = %s AND project_id = %s",
                (dname, project_id))
            if found:
                name_to_id[dname] = found[0]['id']
                continue
            dep_id = name_to_id.get(depends) if depends else None
            rows = execute_query("""
                INSERT INTO deliverables
                    (project_id, project_name, name, description, status, due_date,
                     assigned_to, depends_on, completion_percentage)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
            """, (project_id, name, dname, ddesc, dstatus, due, assignee, dep_id, dpct))
            name_to_id[dname] = rows[0]['id']
            deliverables_created += 1

        # Budget entries
        for (cat, bdesc, planned, actual, day_offset) in DEMO_BUDGET.get(name, []):
            found = execute_query(
                "SELECT id FROM budget_entries WHERE project_id = %s AND category = %s AND description = %s",
                (project_id, cat, bdesc))
            if found:
                continue
            execute_query("""
                INSERT INTO budget_entries
                    (project_id, project_name, category, description,
                     planned_amount, actual_amount, entry_date)
                VALUES (%s,%s,%s,%s,%s,%s,%s)
            """, (project_id, name, cat, bdesc, planned, actual, _d(day_offset)))
            budget_created += 1

        # Derive project completion from its deliverables (Tier A rule).
        dels = execute_query(
            "SELECT completion_percentage FROM deliverables WHERE project_id = %s", (project_id,))
        if dels:
            avg = round(sum(int(d['completion_percentage'] or 0) for d in dels) / len(dels))
            execute_query(
                "UPDATE projects SET completion_percentage = %s WHERE id = %s", (avg, project_id))

        # Keep budget_spent aligned with actual entry totals.
        tot = execute_query(
            "SELECT COALESCE(SUM(actual_amount),0) AS s FROM budget_entries WHERE project_id = %s",
            (project_id,))
        if tot:
            execute_query("UPDATE projects SET budget_spent = %s WHERE id = %s",
                          (tot[0]['s'], project_id))

    # Allocate people to projects so the resource views have real data.
    allocations = {
        'Lena Fischer':  [('Customer Portal Redesign', 12)],
        'Rahul Menon':   [('Customer Portal Redesign', 20), ('Mobile App Launch', 8)],
        'Grace Liu':     [('Customer Portal Redesign', 10), ('Payments API v2', 14), ('Mobile App Launch', 6)],
        'Sana Kapoor':   [('Payments API v2', 30)],
        'Omar Haddad':   [('Payments API v2', 10), ('Cloud Migration Phase 2', 28)],
        'Arjun Pillai':  [('Internal Analytics Dashboard', 16)],
    }
    for person_name, allocs in allocations.items():
        entries = ', '.join(f'{p} ({h}h)' for p, h in allocs)
        total = sum(h for _, h in allocs)
        execute_query(
            "UPDATE people SET projects = %s, allocated_hours = %s WHERE name = %s",
            (entries, total, person_name))

    return {
        'projects_created': projects_created,
        'deliverables_created': deliverables_created,
        'budget_entries_created': budget_created,
        'message': f'{projects_created} projects, {deliverables_created} deliverables, {budget_created} budget entries created.'
    }
