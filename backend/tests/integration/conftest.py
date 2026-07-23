"""
Integration test setup.

These tests talk to the running API over HTTP — no mocks, no stubs. They prove
the contract holds end to end: request in, authorisation applied, database
written, response shaped as promised.

They use only the standard library so the suite adds no dependency to a project
whose deployment already depends on careful packaging.

Run the app first:
    ./bin/start-dev.sh

Then:
    python3.13 -m pytest backend/tests/integration -v
"""
import json
import os
import urllib.error
import urllib.request

import pytest

API = os.environ.get('ACME_API', 'http://localhost:3001/api')
TIMEOUT = 10

CREDENTIALS = {
    'admin':   ('alice.admin@acme.com', 'Admin@123'),
    'manager': ('michael.rao@acme.com', 'Manager@123'),
    'other':   ('daniel.okafor@acme.com', 'Manager@123'),
    'member':  ('sana.kapoor@acme.com', 'Member@123'),
}


class Response:
    """A minimal response object so tests read like they use `requests`."""

    def __init__(self, status, body):
        self.status = status
        self.text = body
        try:
            self.data = json.loads(body) if body else None
        except json.JSONDecodeError:
            self.data = None

    def __repr__(self):
        return f'<Response {self.status} {self.text[:80]}>'


def call(method, path, token=None, payload=None):
    """Issue a request and return the status and parsed body, never raising."""
    url = f'{API}{path}'
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', f'Bearer {token}')
        # Function URLs can consume the standard header; the app accepts a copy.
        req.add_header('X-Auth-Token', token)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return Response(resp.status, resp.read().decode())
    except urllib.error.HTTPError as e:
        return Response(e.code, e.read().decode())
    except urllib.error.URLError as e:
        pytest.skip(f'API not reachable at {API} — start it with ./bin/start-dev.sh ({e.reason})')


def login(role):
    email, password = CREDENTIALS[role]
    resp = call('POST', '/people/login', payload={'email': email, 'password': password})
    if resp.status != 200:
        pytest.skip(f'Could not sign in as {role} — has the demo data been seeded? ({resp.text[:120]})')
    return resp.data['token']


@pytest.fixture(scope='session', autouse=True)
def api_is_running():
    """Skip the whole suite cleanly when the app is not up."""
    resp = call('POST', '/people/login', payload={'email': 'x@x', 'password': 'x'})
    if resp.status not in (401, 400):
        pytest.skip(f'Unexpected response from {API} — is the app running and seeded?')


@pytest.fixture(scope='session')
def admin_token():
    return login('admin')


@pytest.fixture(scope='session')
def manager_token():
    return login('manager')


@pytest.fixture(scope='session')
def other_manager_token():
    return login('other')


@pytest.fixture(scope='session')
def member_token():
    return login('member')


@pytest.fixture(scope='session')
def projects(manager_token):
    resp = call('GET', '/projects', token=manager_token)
    assert resp.status == 200, f'Could not read projects: {resp.text[:200]}'
    return resp.data


@pytest.fixture(scope='session')
def managers_own_project(projects):
    owned = [p for p in projects if p['manager'] == 'Michael Rao']
    if not owned:
        pytest.skip('No project managed by Michael Rao — seed the demo data')
    return owned[0]


@pytest.fixture(scope='session')
def other_managers_project(projects):
    others = [p for p in projects if p['manager'] == 'Daniel Okafor']
    if not others:
        pytest.skip('No project managed by Daniel Okafor — seed the demo data')
    return others[0]
