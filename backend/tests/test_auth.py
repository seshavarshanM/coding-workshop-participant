"""
Authentication — proving the API cannot be used without a valid session.

These are the highest-value tests in the suite: every one of them describes an
attack that would otherwise succeed silently.
"""
import datetime

import jwt
import pytest

from auth import require_auth, AuthError
from conftest import make_token, event_with, JWT_SECRET


class TestTokenRequired:
    def test_request_without_a_token_is_rejected(self):
        with pytest.raises(AuthError) as err:
            require_auth(event_with())
        assert err.value.status == 401

    def test_empty_header_is_rejected(self):
        with pytest.raises(AuthError) as err:
            require_auth({'headers': {'authorization': ''}})
        assert err.value.status == 401

    def test_header_without_bearer_prefix_is_rejected(self):
        with pytest.raises(AuthError):
            require_auth({'headers': {'authorization': make_token()}})

    def test_valid_token_is_accepted(self):
        user = require_auth(event_with(make_token()))
        assert user['name'] == 'Michael Rao'
        assert user['role'] == 'manager'


class TestTokenIntegrity:
    def test_token_signed_with_another_secret_is_rejected(self):
        """A forged admin token must not grant admin access."""
        forged = make_token(name='Attacker', role='admin', secret='not-the-real-secret')
        with pytest.raises(AuthError) as err:
            require_auth(event_with(forged))
        assert err.value.status == 401

    def test_expired_token_is_rejected(self):
        expired = make_token(expires_in_hours=-1)
        with pytest.raises(AuthError) as err:
            require_auth(event_with(expired))
        assert err.value.status == 401
        assert 'expired' in err.value.message.lower()

    def test_tampered_payload_is_rejected(self):
        """Editing the role inside a token invalidates its signature."""
        token = make_token(role='member')
        head, payload, sig = token.split('.')
        forged_payload = jwt.encode({'role': 'admin'}, 'x', algorithm='HS256').split('.')[1]
        with pytest.raises(AuthError):
            require_auth(event_with(f'{head}.{forged_payload}.{sig}'))

    def test_garbage_string_is_rejected(self):
        with pytest.raises(AuthError):
            require_auth(event_with('not-a-jwt-at-all'))


class TestTransportVariations:
    """
    Header casing differs between API Gateway, Lambda Function URLs and the
    local dev proxy, and Function URLs may consume `Authorization` entirely.
    The token must survive all of those paths.
    """

    @pytest.mark.parametrize('header', ['authorization', 'Authorization', 'AUTHORIZATION'])
    def test_header_casing_is_ignored(self, header):
        user = require_auth(event_with(make_token(), header=header))
        assert user['role'] == 'manager'

    def test_fallback_header_is_accepted(self):
        user = require_auth({'headers': {'x-auth-token': make_token()}})
        assert user['name'] == 'Michael Rao'

    def test_fallback_header_without_bearer_prefix(self):
        user = require_auth({'headers': {'X-Auth-Token': make_token()}})
        assert user['name'] == 'Michael Rao'


class TestClaims:
    def test_identity_is_read_from_the_token_not_the_request(self):
        """
        Ownership is assigned from token claims, so a client cannot claim to be
        someone else by putting a different name in the request body.
        """
        user = require_auth(event_with(make_token(name='Priya Nair', role='manager')))
        assert user['name'] == 'Priya Nair'
        assert user['employee_id'] == 'ACME-1002'

    def test_role_defaults_to_member_when_absent(self):
        now = datetime.datetime.now(datetime.timezone.utc)
        token = jwt.encode({'sub': 'u-9', 'name': 'Nobody',
                            'exp': now + datetime.timedelta(hours=1)},
                           JWT_SECRET, algorithm='HS256')
        assert require_auth(event_with(token))['role'] == 'member'
