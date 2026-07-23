"""
The CRUD contract: what is written can be read back, changed, and removed —
with the correct status codes at each step.

Each test cleans up after itself so the suite can run repeatedly against the
same database without leaving debris behind.
"""
from conftest import call


class TestProjectLifecycle:
    def test_create_read_update_then_remove(self, manager_token, admin_token):
        # Create — the manager owns what they create
        created = call('POST', '/projects', token=manager_token, payload={
            'name': 'Integration test project',
            'description': 'Created by the automated suite',
            'department': 'Engineering',
            'status': 'planning',
            'priority': 'low',
            'start_date': '2026-01-01',
            'end_date': '2026-12-01',
            'budget_planned': 25000,
        })
        assert created.status == 201, created.text
        project_id = created.data['id']

        try:
            # Ownership comes from the token, not the request body
            assert created.data['manager'] == 'Michael Rao'

            # Read back
            fetched = call('GET', f'/projects/{project_id}', token=manager_token)
            assert fetched.status == 200
            assert fetched.data['name'] == 'Integration test project'
            assert float(fetched.data['budget_planned']) == 25000

            # Update
            updated = call('PUT', f'/projects/{project_id}', token=manager_token,
                           payload={'status': 'active', 'priority': 'high'})
            assert updated.status == 200
            assert updated.data['status'] == 'active'

            # The change persisted, not just echoed
            assert call('GET', f'/projects/{project_id}',
                        token=manager_token).data['priority'] == 'high'

        finally:
            # Only an administrator may remove a project
            removed = call('DELETE', f'/projects/{project_id}', token=admin_token)
            assert removed.status == 200
            assert call('GET', f'/projects/{project_id}', token=manager_token).status == 404


class TestDeliverableLifecycle:
    def test_create_and_remove_within_an_owned_project(self, manager_token, managers_own_project):
        created = call('POST', '/deliverables', token=manager_token, payload={
            'project_id': managers_own_project['id'],
            'name': 'Integration test deliverable',
            'description': 'Created by the automated suite',
            'status': 'pending',
            'assigned_to': 'Sana Kapoor',
            'due_date': managers_own_project.get('end_date'),
            'completion_percentage': 0,
        })
        assert created.status == 201, created.text
        item_id = created.data['id']

        try:
            assert created.data['project_name'] == managers_own_project['name']
            listed = call('GET', f"/deliverables?project_id={managers_own_project['id']}",
                          token=manager_token)
            assert any(d['id'] == item_id for d in listed.data)
        finally:
            assert call('DELETE', f'/deliverables/{item_id}', token=manager_token).status == 200


class TestBudgetIsRetainedAfterRemoval:
    def test_removed_entries_stay_attributable(self, manager_token, managers_own_project):
        """
        Financial records are soft-deleted: they leave the active list but remain
        readable, with the name of whoever removed them.
        """
        created = call('POST', '/budget', token=manager_token, payload={
            'project_id': managers_own_project['id'],
            'category': 'Tooling',
            'description': 'Integration test entry',
            'planned_amount': 1234,
            'actual_amount': 0,
            'entry_date': managers_own_project.get('start_date'),
        })
        assert created.status == 201, created.text
        entry_id = created.data['id']
        assert created.data['proposed_by'] == 'Michael Rao'
        assert created.data['status'] == 'proposed'

        removed = call('DELETE', f'/budget/{entry_id}', token=manager_token)
        assert removed.status == 200
        assert removed.data['deleted_by'] == 'Michael Rao'

        # Gone from the active list
        active = call('GET', '/budget', token=manager_token)
        assert all(e['id'] != entry_id for e in active.data['entries'])

        # Still attributable
        deleted = call('GET', '/budget/deleted', token=manager_token)
        match = next((e for e in deleted.data if e['id'] == entry_id), None)
        assert match is not None
        assert match['deleted_by'] == 'Michael Rao'


class TestSupportQueue:
    def test_anyone_can_raise_a_ticket_and_an_admin_can_resolve_it(self, member_token, admin_token):
        raised = call('POST', '/support', token=member_token, payload={
            'subject': 'Integration test ticket',
            'description': 'Raised by the automated suite',
            'category': 'other',
            'priority': 'low',
        })
        assert raised.status == 201, raised.text
        ticket_id = raised.data['id']
        assert raised.data['reference'].startswith('TKT-')
        assert raised.data['raised_by'] == 'Sana Kapoor'
        assert raised.data['status'] == 'open'

        # The reporter sees their own ticket
        mine = call('GET', '/support', token=member_token)
        assert any(t['id'] == ticket_id for t in mine.data)

        # A member cannot triage
        assert call('PUT', f'/support/{ticket_id}', token=member_token,
                    payload={'status': 'resolved'}).status == 403

        # An administrator can
        resolved = call('PUT', f'/support/{ticket_id}', token=admin_token,
                        payload={'status': 'resolved', 'resolution': 'Closed by test'})
        assert resolved.status == 200
        assert resolved.data['status'] == 'resolved'


class TestProgressTimeline:
    def test_a_note_is_recorded_against_the_deliverable(self, manager_token, managers_own_project):
        listed = call('GET', f"/deliverables?project_id={managers_own_project['id']}",
                      token=manager_token)
        if not listed.data:
            import pytest
            pytest.skip('No deliverables on the seeded project')
        item_id = listed.data[0]['id']

        posted = call('POST', f'/deliverables/{item_id}/updates', token=manager_token,
                      payload={'note': 'Integration test remark'})
        assert posted.status == 201

        timeline = call('GET', f'/deliverables/{item_id}/updates', token=manager_token)
        assert timeline.status == 200
        assert any(u['note'] == 'Integration test remark' for u in timeline.data)

    def test_an_empty_note_is_refused(self, manager_token, managers_own_project):
        listed = call('GET', f"/deliverables?project_id={managers_own_project['id']}",
                      token=manager_token)
        if not listed.data:
            import pytest
            pytest.skip('No deliverables on the seeded project')
        resp = call('POST', f"/deliverables/{listed.data[0]['id']}/updates",
                    token=manager_token, payload={'note': '   '})
        assert resp.status == 400
