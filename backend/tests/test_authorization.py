"""
Authorization — who may do what.

The role model: administrators run the platform, managers run projects, members
do the work. Administrators are deliberately not business actors.
"""
import pytest

from auth import (require_role, require_project_owner, deny_admin_business_action,
                  is_admin, is_manager, AuthError)


class TestRoleGates:
    def test_admin_passes_an_admin_gate(self, admin):
        require_role(admin, 'admin')          # no exception

    def test_manager_is_refused_an_admin_gate(self, manager):
        with pytest.raises(AuthError) as err:
            require_role(manager, 'admin')
        assert err.value.status == 403

    def test_gate_accepts_any_listed_role(self, manager, admin):
        require_role(manager, 'manager', 'admin')
        require_role(admin, 'manager', 'admin')

    def test_member_is_refused_a_hiring_gate(self, member):
        with pytest.raises(AuthError):
            require_role(member, 'manager', 'admin')


class TestAdminIsNotABusinessActor:
    """
    Administrators oversee the system; they do not create projects or propose
    budgets. That is a project manager's responsibility.
    """

    def test_admin_cannot_create_projects(self, admin):
        with pytest.raises(AuthError) as err:
            deny_admin_business_action(admin, 'create projects')
        assert err.value.status == 403
        assert 'manager' in err.value.message.lower()

    def test_admin_cannot_propose_budget(self, admin):
        with pytest.raises(AuthError):
            deny_admin_business_action(admin, 'propose budgets')

    def test_manager_is_unaffected(self, manager):
        deny_admin_business_action(manager, 'create projects')

    def test_member_is_unaffected_by_this_particular_rule(self, member):
        # Members are stopped by role gates, not by this check.
        deny_admin_business_action(member, 'create projects')


class TestProjectOwnership:
    def test_manager_may_act_on_their_own_project(self, manager, project_of_manager):
        require_project_owner(manager, project_of_manager)

    def test_manager_may_not_act_on_another_managers_project(self, manager, project_of_other):
        with pytest.raises(AuthError) as err:
            require_project_owner(manager, project_of_other)
        assert err.value.status == 403
        assert 'own' in err.value.message.lower()

    def test_admin_is_refused_because_this_is_a_business_action(self, admin, project_of_manager):
        with pytest.raises(AuthError):
            require_project_owner(admin, project_of_manager)

    def test_member_is_refused(self, member, project_of_manager):
        with pytest.raises(AuthError):
            require_project_owner(member, project_of_manager)

    def test_missing_project_reports_not_found(self, manager):
        with pytest.raises(AuthError) as err:
            require_project_owner(manager, None)
        assert err.value.status == 404


class TestRoleHelpers:
    def test_is_admin(self, admin, manager, member):
        assert is_admin(admin) is True
        assert is_admin(manager) is False
        assert is_admin(member) is False

    def test_is_manager(self, admin, manager, member):
        assert is_manager(manager) is True
        assert is_manager(admin) is False
        assert is_manager(member) is False
