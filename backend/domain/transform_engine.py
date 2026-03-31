"""
TransformEngine: All 10 FT property operations.

Pure-function class implementing shift, complex exponential,
stretch, mirror, even/odd, rotation, differentiation, integration,
2D windowing, and repeated FT.

All methods are static — no instance state (Constitution §II).
Uses NumPy vectorized operations for performance.
"""

import numpy as np
from scipy import ndimage, signal


class TransformEngine:
    """
    Implements all 10 FT property operations as static methods.

    Every method takes a numpy array (2D, float64 or complex128)
    and returns a transformed numpy array. No side effects.
    """

    # ── 1. Shift ─────────────────────────────────────────────────────

    @staticmethod
    def shift(array: np.ndarray, dx: int, dy: int) -> np.ndarray:
        """
        Circular shift by (dx, dy) pixels.

        Uses np.roll for efficient circular shifting.

        Args:
            array: 2D input array.
            dx: Horizontal shift (positive = right).
            dy: Vertical shift (positive = down).

        Returns:
            Shifted array of same shape.
        """
        return np.roll(array, (dy, dx), axis=(0, 1))

    # ── 2. Complex Exponential ───────────────────────────────────────

    @staticmethod
    def complex_exponential(
        array: np.ndarray, fx: float, fy: float
    ) -> np.ndarray:
        """
        Multiply by complex exponential exp(2jπ(fx·x + fy·y)).

        Args:
            array: 2D input array.
            fx: Horizontal frequency (cycles/pixel).
            fy: Vertical frequency (cycles/pixel).

        Returns:
            Complex-valued array of same shape.
        """
        h, w = array.shape[:2]
        y_coords, x_coords = np.mgrid[0:h, 0:w]
        phase = 2.0 * np.pi * (fx * x_coords / w + fy * y_coords / h)
        exponential = np.exp(1j * phase)
        return array * exponential

    # ── 3. Stretch ───────────────────────────────────────────────────

    @staticmethod
    def stretch(array: np.ndarray, factor: float) -> np.ndarray:
        """
        Scale array by the given factor using scipy.ndimage.zoom.

        Args:
            array: 2D input array.
            factor: Scale factor (>0). 2.0 = double size.

        Returns:
            Scaled array with new dimensions.
        """
        if factor <= 0:
            raise ValueError(f"Stretch factor must be > 0, got {factor}")
        return ndimage.zoom(array, factor, order=3)

    # ── 4. Mirror ────────────────────────────────────────────────────

    @staticmethod
    def mirror(array: np.ndarray, axis: str) -> np.ndarray:
        """
        Flip the array along the specified axis.

        Args:
            array: 2D input array.
            axis: 'horizontal' (flip cols), 'vertical' (flip rows),
                  or 'both'.

        Returns:
            Flipped array of same shape.
        """
        if axis == "horizontal":
            return np.flip(array, axis=1)
        elif axis == "vertical":
            return np.flip(array, axis=0)
        elif axis == "both":
            return np.flip(array, axis=(0, 1))
        else:
            raise ValueError(
                f"Invalid axis '{axis}'. Must be 'horizontal', 'vertical', or 'both'."
            )

    # ── 5. Even/Odd ──────────────────────────────────────────────────

    @staticmethod
    def even_odd(array: np.ndarray, mode: str) -> np.ndarray:
        """
        Decompose into even or odd part: (f(x) ± f(-x)) / 2.

        Args:
            array: 2D input array.
            mode: 'even' or 'odd'.

        Returns:
            Even or odd component of the signal.
        """
        flipped = np.flip(array, axis=(0, 1))
        if mode == "even":
            return (array + flipped) / 2.0
        elif mode == "odd":
            return (array - flipped) / 2.0
        else:
            raise ValueError(f"Invalid mode '{mode}'. Must be 'even' or 'odd'.")

    # ── 6. Rotate ────────────────────────────────────────────────────

    @staticmethod
    def rotate(array: np.ndarray, angle_deg: float) -> np.ndarray:
        """
        Rotate by angle_deg degrees with canvas expansion.

        Uses scipy.ndimage.rotate with reshape=True to enlarge
        the canvas to fit the full rotated image (FR-009).

        Args:
            array: 2D input array.
            angle_deg: Rotation angle in degrees.

        Returns:
            Rotated array with enlarged canvas.
        """
        return ndimage.rotate(array, angle_deg, reshape=True, order=3)

    # ── 7. Differentiate ─────────────────────────────────────────────

    @staticmethod
    def differentiate(array: np.ndarray) -> np.ndarray:
        """
        Compute spatial derivative (gradient magnitude).

        Uses np.gradient for both axes and returns the magnitude.

        Args:
            array: 2D input array.

        Returns:
            Gradient magnitude array.
        """
        gy, gx = np.gradient(array.astype(np.float64))
        return np.sqrt(gx**2 + gy**2)

    # ── 8. Integrate ─────────────────────────────────────────────────

    @staticmethod
    def integrate(array: np.ndarray) -> np.ndarray:
        """
        Compute spatial integration (cumulative sum along axis 0).

        Args:
            array: 2D input array.

        Returns:
            Integrated array.
        """
        return np.cumsum(array.astype(np.float64), axis=0)

    # ── 9. 2D Windowing ──────────────────────────────────────────────

    @staticmethod
    def window_2d(
        array: np.ndarray,
        window_type: str,
        sigma: float = 1.0,
    ) -> np.ndarray:
        """
        Apply a 2D window function.

        Constructs a 2D window as the outer product of two 1D windows
        matching the array shape, then multiplies element-wise.

        Args:
            array: 2D input array.
            window_type: 'rectangular', 'gaussian', 'hamming', or 'hanning'.
            sigma: Standard deviation for Gaussian window (in pixels).

        Returns:
            Windowed array.
        """
        h, w = array.shape[:2]

        if window_type == "rectangular":
            win_h = np.ones(h)
            win_w = np.ones(w)
        elif window_type == "gaussian":
            win_h = signal.windows.gaussian(h, std=sigma * h / 4)
            win_w = signal.windows.gaussian(w, std=sigma * w / 4)
        elif window_type == "hamming":
            win_h = signal.windows.hamming(h)
            win_w = signal.windows.hamming(w)
        elif window_type == "hanning":
            win_h = signal.windows.hann(h)
            win_w = signal.windows.hann(w)
        else:
            raise ValueError(
                f"Unknown window_type '{window_type}'. "
                "Must be 'rectangular', 'gaussian', 'hamming', or 'hanning'."
            )

        window_2d = np.outer(win_h, win_w)
        return array * window_2d

    # ── 10. Repeated FT ──────────────────────────────────────────────

    @staticmethod
    def repeated_ft(array: np.ndarray, count: int) -> np.ndarray:
        """
        Apply FFT2 repeatedly N times.

        Known property: applying FFT 4 times returns ~ original.

        Args:
            array: 2D input array.
            count: Number of FFT applications (≥1).

        Returns:
            Result after N forward FFTs.
        """
        if count < 1:
            return array.copy()

        result = array.astype(np.complex128)
        for _ in range(count):
            result = np.fft.fft2(result)
        return result
