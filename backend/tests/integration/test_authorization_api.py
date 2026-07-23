"""
Authorization against the live API.

The role model is asserted where it counts — at the endpoint, not in a helper.
A hidden button proves nothing if the API still accepts the request.
"""
from conftest import call


class TestAdminIsNotABusinessActor:
    def test_admin_cannot_create_a_project(self, admin_token):
        resp = call('POST', '/projects', token=admin_token, payload={
            'name': 'Should never exist', 'department': 'Ops',
            'start_date': '2026-01-01', 'end_date': '2026-06-01', 'budget_planned': 1000,
        })
        assert resp.status == 403
        assert 'manager' in resp.data['message'].lower()

    def test_admin_cannot_propose_budget(self, admin_token, managers_own_project):
        resp = call('POST', '/budget', token=admin_token, payload={
            'project_id': managers_own_project['id'],
            'category': 'Personnel', 'planned_amount': 1000,
        })
        assert resp.status == 403

    def test_admin_cannot_create_deliverables(self, admin_token, managers_own_project):
        resp = call('POST', '/deliverables', token=admin_token, payload={
            'project_id': managers_own_project['id'], 'name': 'Should never exist',
        })
        assert resp.status == 403

    def test_admin_can_still_read_everything(self, admin_token):
        for path in ('/projects', '/deliverables', '/people'):
            assert call('GET', path, token=admin_token).status == 200


class TestManagersAreScopedToWhatTheyOwn:
    def test_manager_may_edit_their_own_project(self, manager_token, managers_own_project):
        resp = call('PUT', f"/projects/{managers_own_project['id']}",
                    token=manager_token, payload={'description': managers_own_project.get('description', '')})
        assert resp.status == 200

    def test_manager_may_not_edit_another_managers_project(self, manager_token, other_managers_project):
        resp = call('PUT', f"/projects/{other_managers_project['id']}",
                    token=manager_token, payload={'description': 'should not apply'})
        assert resp.status == 403
        assert 'own' in resp.data['message'].lower()

    def test_manager_may_not_add_deliverables_to_another_managers_project(
            self, manager_token, other_managers_project):
        resp = call('POST', '/deliverables', token=manager_token, payload={
            'project_id': other_managers_project['id'], 'name': 'Should never exist',
        })
        assert resp.status == 403

    def test_manager_may_not_add_budget_to_another_managers_project(
            self, manager_token, other_managers_project):
        resp = call('POST', '/budget', token=manager_token, payload={
            'project_id': other_managers_project['id'],
            'category': 'Personnel', 'planned_amount': 500,
        })
        assert resp.status == 403

    def test_manager_may_not_delete_a_project(self, manager_token, managers_own_project):
        """Deletion is a compliance action reserved for administrators."""
        resp = call('DELETE', f"/projects/{managers_own_project['id']}", token=manager_token)
        assert resp.status == 403
        # and the project is still there
        assert call('GET', f"/projects/{managers_own_project['id']}", token=manager_token).status == 200


class TestMembersDoTheWork:
    def test_member_cannot_create_a_project(self, member_token):
        resp = call('POST', '/projects', token=member_token, payload={'name': 'Should never exist'})
        assert resp.status == 403

    def test_member_cannot_create_deliverables(self, member_token, managers_own_project):
        resp = call('POST', '/deliverables', token=member_token, payload={
            'project_id': managers_own_project['id'], 'name': 'Should never exist',
        })
        assert resp.status == 403

    def test_member_cannot_propose_budget(self, member_token, managers_own_project):
        resp = call('POST', '/budget', token=member_token, payload={
            'project_id': managers_own_project['id'],
            'category': 'Personnel', 'planned_amount': 100,
        })
        assert resp.status == 403

    def test_member_cannot_hire(self, member_token):
        resp = call('POST', '/people', token=member_token, payload={
            'name': 'Should never exist', 'email': 'ghost@acme.com', 'password': 'Whatever@123',
        })
        assert resp.status == 403

    def test_member_can_read(self, member_token):
        assert call('GET', '/projects', token=member_token).status == 200
        assert call('GET', '/deliverables', token=member_token).status == 200
