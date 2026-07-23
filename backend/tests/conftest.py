"""
Shared test setup.

The Lambda services each keep a self-contained copy of the shared modules, so
tests import from one service directory. Nothing here touches a database: these
are unit tests of decision-making logic, which is where being wrong is costly.
"""
import datetime
import os
import sys

import pytest

# Import the modules under test from the projects service.
BACKEND = os.path.join(os.path.dirname(__file__), '..', 'projects')
sys.path.insert(0, os.path.abspath(BACKEND))

import jwt  # noqa: E402

JWT_SECRET = 'acme-workshop-dev-secret-change-in-prod'


def make_token(name='Michael Rao', role='manager', user_id='u-2',
               employee_id='ACME-1002', expires_in_hours=1, secret=JWT_SECRET):
    """Build a signed token the way the login endpoint does."""
    now = datetime.datetime.now(datetime.timezone.utc)
    return jwt.encode(
        {
            'sub': user_id,
            'name': name,
            'role': role,
            'employee_id': employee_id,
            'email': f'{name.split()[0].lower()}@acme.com',
            'iat': now,
            'exp': now + datetime.timedelta(hours=expires_in_hours),
        },
        secret,
        algorithm='HS256',
    )


def event_with(token=None, header='authorization', method='GET', path='/api/projects', body=None):
    """Build a Lambda event the way API Gateway or a Function URL delivers one."""
    evt = {'httpMethod': method, 'path': path, 'headers': {}}
    if token:
        evt['headers'][header] = f'Bearer {token}'
    if body is not None:
        evt['body'] = body
    return evt


# ── Fixtures: the cast used across the suite ──────────────────────────────
@pytest.fixture
def admin():
    return {'id': 'u-1', 'name': 'Alice Fernandes', 'role': 'admin', 'employee_id': 'ACME-1001'}


@pytest.fixture
def manager():
    return {'id': 'u-2', 'name': 'Michael Rao', 'role': 'manager', 'employee_id': 'ACME-1002'}


@pytest.fixture
def other_manager():
    return {'id': 'u-4', 'name': 'Daniel Okafor', 'role': 'manager', 'employee_id': 'ACME-1004'}


@pytest.fixture
def member():
    return {'id': 'u-5', 'name': 'Sana Kapoor', 'role': 'member', 'employee_id': 'ACME-1005'}


@pytest.fixture
def project_of_manager():
    return {'id': 'p-1', 'name': 'Payments API v2', 'manager': 'Michael Rao'}


@pytest.fixture
def project_of_other():
    return {'id': 'p-2', 'name': 'Cloud Migration Phase 2', 'manager': 'Daniel Okafor'}
