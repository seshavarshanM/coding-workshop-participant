"""
Shared authentication & authorization for all ACME backend services.

Every protected endpoint must call require_auth(event) first. It verifies the
JWT issued at login and returns the caller's identity. Authorization helpers
then decide whether that identity may perform the action.

Role model
----------
admin   : system administrator. Read-only on business data; manages accounts,
          performs compliance deletions, reviews the audit log.
          Does NOT create projects, propose budgets or assign work.
manager : primary business actor. Owns projects end to end - creates them,
          proposes budgets, manages deliverables, hires team members.
          Scoped: may only act on projects where they are the manager.
member  : does the work. Reports progress on deliverables assigned to them.
"""
import json
import os
import jwt

JWT_SECRET = os.environ.get('JWT_SECRET', 'acme-workshop-dev-secret-change-in-prod')
JWT_ALGO = 'HS256'

HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
}


def respond(status, body):
    return {'statusCode': status, 'headers': HEADERS, 'body': json.dumps(body, default=str)}


class AuthError(Exception):
    """Raised when a request is unauthenticated (401) or forbidden (403)."""
    def __init__(self, status, message):
        self.status = status
        self.message = message
        super().__init__(message)


def _bearer_token(event):
    """
    Extract the JWT from the request.

    Lambda Function URLs reserve the standard `Authorization` header for IAM
    signature verification and may consume it before the function sees it, so
    we also accept `X-Auth-Token`. The frontend sends both; whichever survives
    the transport is used.
    """
    headers = event.get('headers') or {}
    # TEMPORARY DIAGNOSTIC — shows exactly which headers reach the function.
    print(f"AUTH_DEBUG headers_received={sorted(headers.keys())}")
    # Header names arrive with inconsistent casing across API Gateway,
    # Function URLs and the local proxy — normalise before reading.
    lower = {str(k).lower(): v for k, v in headers.items()}
    print(f"AUTH_DEBUG has_authorization={'authorization' in lower} has_x_auth_token={'x-auth-token' in lower}")

    raw = lower.get('authorization') or ''
    if raw.lower().startswith('bearer '):
        return raw.split(' ', 1)[1].strip()

    fallback = lower.get('x-auth-token') or ''
    if fallback:
        if fallback.lower().startswith('bearer '):
            return fallback.split(' ', 1)[1].strip()
        return fallback.strip()

    return None


def require_auth(event):
    """
    Verifies the caller's JWT.

    Returns a dict: {id, employee_id, email, role, name}
    Raises AuthError(401) when the token is missing, malformed or expired.
    """
    token = _bearer_token(event)
    if not token:
        raise AuthError(401, 'Authentication required')
    try:
        claims = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise AuthError(401, 'Session expired, please sign in again')
    except jwt.InvalidTokenError:
        raise AuthError(401, 'Invalid authentication token')

    return {
        'id': claims.get('sub'),
        'employee_id': claims.get('employee_id'),
        'email': claims.get('email'),
        'role': claims.get('role', 'member'),
        'name': claims.get('name'),
    }


# ── Authorization helpers ────────────────────────────────────────────────
def require_role(user, *roles):
    """Caller must hold one of the given roles."""
    if user.get('role') not in roles:
        raise AuthError(403, f"This action requires: {' or '.join(roles)}")


def deny_admin_business_action(user, action='perform this action'):
    """
    Admins administer the system; they do not run projects.
    Business actions (creating projects, proposing budgets, assigning work)
    belong to managers.
    """
    if user.get('role') == 'admin':
        raise AuthError(
            403,
            f'Administrators oversee the system and cannot {action}. '
            'This is a project manager responsibility.'
        )


def require_project_owner(user, project, action='modify this project'):
    """
    Managers may only act on projects they manage.
    Raises 403 otherwise. Admins are rejected for business actions.
    """
    deny_admin_business_action(user, action)
    require_role(user, 'manager')
    if not project:
        raise AuthError(404, 'Project not found')
    if project.get('manager') != user.get('name'):
        raise AuthError(403, 'You can only manage projects you own')


def is_admin(user):
    return user.get('role') == 'admin'


def is_manager(user):
    return user.get('role') == 'manager'


def handle_auth_error(err):
    """Convert an AuthError into a consistent HTTP response."""
    return respond(err.status, {'message': err.message})