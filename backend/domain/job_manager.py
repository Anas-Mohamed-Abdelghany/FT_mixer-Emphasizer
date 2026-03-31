"""
JobManager: Threaded execution with progress reporting and cancellation.

Manages background computation jobs using asyncio.to_thread.
Each new submit() cancels the previous job via a threading.Event.
Progress is tracked per-session and reported via get_progress().

Constitution §VI: Cancelable Jobs — JobManager with request ID tokens.
"""

import asyncio
import threading
import time
from typing import Any, Callable, Optional


class JobManager:
    """
    Manages threaded execution, progress, and cancellation for a session.

    Attributes:
        _current_request_id: Monotonically increasing request counter.
        _cancel_event: Cancellation token for the current job.
        _progress: Current progress (0.0–1.0).
        _bottleneck: Simulated delay toggle.
        _result: The result of the latest completed job.
    """

    def __init__(self) -> None:
        self._current_request_id: int = 0
        self._cancel_event: threading.Event = threading.Event()
        self._progress: float = 0.0
        self._bottleneck: bool = False
        self._result: Optional[Any] = None
        self._lock: threading.Lock = threading.Lock()

    async def submit(self, fn: Callable[..., Any], *args: Any) -> int:
        """
        Submit a function for background execution.

        Cancels any previous job, increments request ID, and runs fn
        in a background thread via asyncio.to_thread.

        The submitted function receives `cancel_event` and `set_progress`
        as the first two arguments, followed by *args.

        Args:
            fn: The callable to execute. Signature:
                fn(cancel_event: threading.Event, set_progress: Callable, *args)
            *args: Arguments to pass to fn after the injected params.

        Returns:
            The new request ID.
        """
        with self._lock:
            # Cancel previous job
            self._cancel_event.set()

            # Create fresh cancel event for new job
            self._cancel_event = threading.Event()
            self._current_request_id += 1
            self._progress = 0.0
            self._result = None
            request_id = self._current_request_id
            cancel_event = self._cancel_event

        def _wrapper() -> Any:
            """Wrapper that injects cancel_event and set_progress."""
            # Run bottleneck simulation if enabled
            if self._bottleneck:
                steps = 20
                for i in range(steps):
                    if cancel_event.is_set():
                        return None
                    time.sleep(0.5)  # 20 × 0.5s = 10s total
                    self.set_progress(i / steps * 0.5)  # 0–50% during bottleneck

            if cancel_event.is_set():
                return None

            result = fn(cancel_event, self.set_progress, *args)

            if not cancel_event.is_set():
                with self._lock:
                    if self._current_request_id == request_id:
                        self._result = result
                        self._progress = 1.0

            return result

        # Run in a background thread
        asyncio.get_event_loop().run_in_executor(None, _wrapper)

        return request_id

    def cancel(self) -> None:
        """Set the cancel event for the current job."""
        self._cancel_event.set()

    def get_progress(self) -> tuple[int, float]:
        """
        Get current progress.

        Returns:
            Tuple of (request_id, progress) where progress is 0.0–1.0.
        """
        with self._lock:
            return (self._current_request_id, self._progress)

    def is_latest(self, request_id: int) -> bool:
        """
        Check if the given request ID is the latest.

        Args:
            request_id: The request ID to check.

        Returns:
            True if this is the latest request.
        """
        with self._lock:
            return self._current_request_id == request_id

    def set_progress(self, progress: float) -> None:
        """
        Update the current progress value. Thread-safe.

        Args:
            progress: New progress value (0.0–1.0).
        """
        with self._lock:
            self._progress = max(0.0, min(1.0, progress))

    def get_result(self) -> Optional[Any]:
        """
        Get the result of the latest completed job.

        Returns:
            The result, or None if not yet completed.
        """
        with self._lock:
            return self._result

    @property
    def bottleneck(self) -> bool:
        """Whether bottleneck simulation is enabled."""
        return self._bottleneck

    @bottleneck.setter
    def bottleneck(self, value: bool) -> None:
        """Toggle bottleneck simulation."""
        self._bottleneck = value

    @property
    def cancel_event(self) -> threading.Event:
        """The current cancellation event."""
        return self._cancel_event
