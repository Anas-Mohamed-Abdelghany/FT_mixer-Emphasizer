"""
Tests for JobManager — threading, cancellation, progress, and bottleneck.
"""

import asyncio
import time

import pytest

from backend.domain.job_manager import JobManager


@pytest.fixture
def job_manager():
    """Create a fresh JobManager."""
    return JobManager()


# ── Basic submit ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_submit_returns_incremented_id(job_manager):
    """submit() should return an incrementing request ID."""
    def dummy(cancel_event, set_progress):
        set_progress(1.0)
        return "done"

    id1 = await job_manager.submit(dummy)
    assert id1 == 1

    id2 = await job_manager.submit(dummy)
    assert id2 == 2


@pytest.mark.asyncio
async def test_submit_runs_function(job_manager):
    """submit() should actually run the provided function."""
    result_holder = []

    def compute(cancel_event, set_progress):
        result_holder.append(42)
        set_progress(1.0)
        return 42

    await job_manager.submit(compute)
    # Give the thread time to run
    await asyncio.sleep(0.3)

    assert result_holder == [42]


@pytest.mark.asyncio
async def test_submit_passes_extra_args(job_manager):
    """Extra args should be forwarded to the function."""
    result_holder = []

    def compute(cancel_event, set_progress, a, b):
        result_holder.append(a + b)
        set_progress(1.0)
        return a + b

    await job_manager.submit(compute, 10, 20)
    await asyncio.sleep(0.3)

    assert result_holder == [30]


# ── Cancellation ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_new_submit_cancels_previous(job_manager):
    """A new submit() should set the cancel event on the previous job."""
    cancel_seen = []

    def slow_fn(cancel_event, set_progress):
        time.sleep(0.5)
        cancel_seen.append(cancel_event.is_set())
        return "result"

    await job_manager.submit(slow_fn)
    # Immediately submit another — previous should be cancelled
    await job_manager.submit(slow_fn)

    await asyncio.sleep(1.0)
    # The first job's cancel_event should have been set
    assert True in cancel_seen


@pytest.mark.asyncio
async def test_cancel_method(job_manager):
    """cancel() should set the cancel event."""
    def slow_fn(cancel_event, set_progress):
        time.sleep(1.0)

    await job_manager.submit(slow_fn)
    job_manager.cancel()
    assert job_manager.cancel_event.is_set()


# ── Progress ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_progress_starts_at_zero(job_manager):
    """Progress should start at 0 after submit."""
    def slow_fn(cancel_event, set_progress):
        time.sleep(0.5)

    await job_manager.submit(slow_fn)
    req_id, progress = job_manager.get_progress()
    assert req_id == 1
    assert progress == 0.0


@pytest.mark.asyncio
async def test_progress_updates(job_manager):
    """set_progress should update the reported progress."""
    def fn_with_progress(cancel_event, set_progress):
        set_progress(0.5)
        time.sleep(0.2)
        set_progress(1.0)

    await job_manager.submit(fn_with_progress)
    await asyncio.sleep(0.1)
    _, progress = job_manager.get_progress()
    assert progress >= 0.5


# ── is_latest ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_is_latest_true_for_current(job_manager):
    """is_latest should return True for the current request ID."""
    def dummy(cancel_event, set_progress):
        pass

    req_id = await job_manager.submit(dummy)
    assert job_manager.is_latest(req_id)


@pytest.mark.asyncio
async def test_is_latest_false_for_old(job_manager):
    """is_latest should return False for superseded request IDs."""
    def dummy(cancel_event, set_progress):
        pass

    req_id1 = await job_manager.submit(dummy)
    await job_manager.submit(dummy)
    assert not job_manager.is_latest(req_id1)


# ── Bottleneck ───────────────────────────────────────────────────────


def test_bottleneck_default_off(job_manager):
    """Bottleneck should be off by default."""
    assert job_manager.bottleneck is False


def test_bottleneck_toggle(job_manager):
    """Bottleneck should be toggleable."""
    job_manager.bottleneck = True
    assert job_manager.bottleneck is True
    job_manager.bottleneck = False
    assert job_manager.bottleneck is False


# ── Result retrieval ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_result_after_completion(job_manager):
    """get_result should return the job's return value."""
    def compute(cancel_event, set_progress):
        set_progress(1.0)
        return "answer"

    await job_manager.submit(compute)
    await asyncio.sleep(0.3)

    result = job_manager.get_result()
    assert result == "answer"
