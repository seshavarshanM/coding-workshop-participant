"""
Business rules enforced by the API.

The interface disables controls to keep people out of invalid states, but the
rules only hold if the service refuses the request regardless. These tests
bypass the interface entirely.
"""
from conftest import call


class TestFinishToStartDependency:
    """Work cannot record progress until the work it depends on has finished."""

    def _blocked_deliverable(self, token):
        resp = call('GET', '/deliverables', token=token)
        assert resp.status == 200
        by_id = {d['id']: d for d in resp.data}
        for d in resp.data:
            dep = by_id.get(d.get('depends_on'))
            if dep and dep['status'] != 'completed':
                return d, dep
        return None, None

    def test_completing_blocked_work_is_refused(self, manager_token):
        item, dep = self._blocked_deliverable(manager_token)
        if not item:
            import pytest
            pytest.skip('No blocked deliverable in the seeded data')
        resp = call('PUT', f"/deliverables/{item['id']}", token=manager_token,
                    payload={'status': 'completed', 'note': 'trying to jump ahead'})
        assert resp.status == 400
        assert dep['name'] in resp.data['message']

    def test_starting_blocked_work_is_refused(self, manager_token):
        item, _ = self._blocked_deliverable(manager_token)
        if not item:
            import pytest
            pytest.skip('No blocked deliverable in the seeded data')
        resp = call('PUT', f"/deliverables/{item['id']}", token=manager_token,
                    payload={'completion_percentage': 50, 'note': 'starting early'})
        assert resp.status == 400

    def test_the_refusal_explains_what_is_blocking(self, manager_token):
        item, dep = self._blocked_deliverable(manager_token)
        if not item:
            import pytest
            pytest.skip('No blocked deliverable in the seeded data')
        resp = call('PUT', f"/deliverables/{item['id']}", token=manager_token,
                    payload={'status': 'completed', 'note': 'x'})
        assert 'must be completed first' in resp.data['message']


class TestProgressRequiresANote:
    """A percentage on its own records nothing useful a week later."""

    def test_moving_progress_without_a_note_is_refused(self, manager_token):
        resp = call('GET', '/deliverables', token=manager_token)
        by_id = {d['id']: d for d in resp.data}
        movable = next(
            (d for d in resp.data
             if d['status'] != 'completed'
             and (not d.get('depends_on') or by_id.get(d['depends_on'], {}).get('status') == 'completed')
             and d['project_name'] in ('Payments API v2', 'Mobile App Launch')),
            None)
        if not movable:
            import pytest
            pytest.skip('No movable deliverable on a project this manager owns')

        new_pct = min(99, int(movable['completion_percentage'] or 0) + 1)
        refused = call('PUT', f"/deliverables/{movable['id']}", token=manager_token,
                       payload={'completion_percentage': new_pct})
        assert refused.status == 400
        assert 'note' in refused.data['message'].lower()

        # With a note, the same change is accepted.
        accepted = call('PUT', f"/deliverables/{movable['id']}", token=manager_token,
                        payload={'completion_percentage': new_pct, 'note': 'Integration test'})
        assert accepted.status == 200


class TestValidation:
    def test_a_project_needs_a_name(self, manager_token):
        resp = call('POST', '/projects', token=manager_token, payload={'department': 'Ops'})
        assert resp.status == 400

    def test_unknown_records_report_not_found(self, manager_token):
        missing = '00000000-0000-0000-0000-000000000000'
        assert call('GET', f'/projects/{missing}', token=manager_token).status == 404
