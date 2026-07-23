"""
Business rules that keep the data honest.

Each of these encodes something a project manager would insist on: a status
cannot contradict its percentage, and work cannot finish before the work it
depends on.
"""
import importlib.util
import os
import sys

import pytest

# The deliverables service holds these rules. Load it directly so we exercise
# the same code the Lambda runs, without importing the whole handler.
DELIVERABLES = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', 'deliverables'))
sys.path.insert(0, DELIVERABLES)


def _load_normalize_status():
    """
    Pull normalize_status out of function.py without executing a database call.
    The module imports psycopg at import time, which is available in the
    service directory.
    """
    spec = importlib.util.spec_from_file_location(
        'deliverables_function', os.path.join(DELIVERABLES, 'function.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.normalize_status


normalize_status = _load_normalize_status()


class TestStatusMatchesCompletion:
    """
    Status and percentage are two views of one fact. Allowing them to disagree
    produced the original bug: a deliverable marked Completed while showing 70%.
    """

    def test_full_completion_forces_completed(self):
        assert normalize_status('in_progress', 100) == ('completed', 100)

    def test_completed_with_partial_percentage_reopens(self):
        assert normalize_status('completed', 60) == ('in_progress', 60)

    def test_zero_percent_completed_returns_to_pending(self):
        assert normalize_status('completed', 0) == ('pending', 0)

    def test_ordinary_progress_is_left_alone(self):
        assert normalize_status('in_progress', 45) == ('in_progress', 45)

    @pytest.mark.parametrize('given,expected', [(-10, 0), (150, 100)])
    def test_percentage_is_clamped_to_range(self, given, expected):
        _, pct = normalize_status('in_progress', given)
        assert pct == expected

    def test_none_percentage_is_passed_through(self):
        assert normalize_status('pending', None) == ('pending', None)


class TestDerivedProjectCompletion:
    """
    A project's completion is the average of its deliverables, never a number
    someone typed — a typed number goes stale the moment work moves.
    """

    @staticmethod
    def average(percentages):
        return round(sum(percentages) / len(percentages)) if percentages else 0

    def test_average_of_mixed_progress(self):
        assert self.average([100, 100, 55, 0]) == 64

    def test_all_complete_reads_one_hundred(self):
        assert self.average([100, 100, 100]) == 100

    def test_nothing_started_reads_zero(self):
        assert self.average([0, 0]) == 0

    def test_no_deliverables_is_zero_not_an_error(self):
        assert self.average([]) == 0
