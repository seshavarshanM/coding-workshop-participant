"""
Authentication against the live API.

Each test here is an attack executed for real: no token, wrong password, forged
token. A pass means the deployed service actually refused it — not that a helper
function would have.
"""
from conftest import call, CREDENTIALS


class TestSignIn:
    def test_correct_credentials_return_a_token_and_profile(self):
        email, password = CREDENTIALS['manager']
        resp = call('POST', '/people/login', payload={'email': email, 'password': password})
        assert resp.status == 200
        assert resp.data['token']
        assert resp.data['user']['name'] == 'Michael Rao'
        assert resp.data['user']['role'] == 'manager'

    def test_wrong_password_is_refused(self):
        email, _ = CREDENTIALS['manager']
        resp = call('POST', '/people/login', payload={'email': email, 'password': 'wrong-password'})
        assert resp.status == 401

    def test_unknown_email_is_refused(self):
        resp = call('POST', '/people/login',
                    payload={'email': 'nobody@acme.com', 'password': 'Manager@123'})
        assert resp.status == 401

    def test_failures_are_indistinguishable(self):
        """
        A different message for 'no such user' would let anyone enumerate which
        accounts exist. Both failures must look identical.
        """
        email, _ = CREDENTIALS['manager']
        wrong_password = call('POST', '/people/login',
                              payload={'email': email, 'password': 'nope'})
        wrong_email = call('POST', '/people/login',
                           payload={'email': 'ghost@acme.com', 'password': 'nope'})
        assert wrong_password.status == wrong_email.status == 401
        assert wrong_password.data['message'] == wrong_email.data['message']

    def test_missing_fields_are_rejected(self):
        assert call('POST', '/people/login', payload={'email': 'a@b.com'}).status == 400
        assert call('POST', '/people/login', payload={}).status == 400


class TestPasswordsAreNeverExposed:
    def test_login_response_carries_no_hash(self, manager_token):
        email, password = CREDENTIALS['manager']
        resp = call('POST', '/people/login', payload={'email': email, 'password': password})
        assert 'password_hash' not in resp.text
        assert 'password' not in resp.data['user']

    def test_people_listing_carries_no_hashes(self, admin_token):
        resp = call('GET', '/people', token=admin_token)
        assert resp.status == 200
        assert 'password_hash' not in resp.text


class TestProtectedEndpoints:
    """Every read and write must present a valid session."""

    def test_reading_projects_without_a_token_is_refused(self):
        assert call('GET', '/projects').status == 401

    def test_reading_deliverables_without_a_token_is_refused(self):
        assert call('GET', '/deliverables').status == 401

    def test_reading_budget_without_a_token_is_refused(self):
        assert call('GET', '/budget').status == 401

    def test_reading_people_without_a_token_is_refused(self):
        assert call('GET', '/people').status == 401

    def test_deleting_without_a_token_is_refused(self, managers_own_project):
        """The exact request that used to destroy data with no credentials."""
        resp = call('DELETE', f"/projects/{managers_own_project['id']}")
        assert resp.status == 401

    def test_forged_token_is_refused(self):
        forged = ('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
                  '.eyJzdWIiOiJ4Iiwicm9sZSI6ImFkbWluIiwiZXhwIjo5OTk5OTk5OTk5fQ'
                  '.not-a-valid-signature')
        assert call('GET', '/projects', token=forged).status == 401

    def test_garbage_token_is_refused(self):
        assert call('GET', '/projects', token='clearly-not-a-jwt').status == 401

    def test_valid_token_is_accepted(self, manager_token):
        resp = call('GET', '/projects', token=manager_token)
        assert resp.status == 200
        assert isinstance(resp.data, list)
