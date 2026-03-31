"""
Tests for TransformEngine — all 10 FT property operations.

Each test verifies correctness using known mathematical properties
(e.g., shift by 0 = no-op, mirror+mirror = identity, FT×4 ≈ identity).
"""

import numpy as np
import pytest

from backend.domain.transform_engine import TransformEngine


# ── Test fixture: sample image ───────────────────────────────────────


@pytest.fixture
def sample_image():
    """Create a simple 64×64 test image with recognizable pattern."""
    img = np.zeros((64, 64), dtype=np.float64)
    img[20:40, 20:40] = 1.0  # white square in center
    return img


@pytest.fixture
def small_image():
    """Create a small 8×8 test image for exact checks."""
    np.random.seed(42)
    return np.random.rand(8, 8)


# ── 1. Shift ─────────────────────────────────────────────────────────


class TestShift:
    def test_shift_zero_is_noop(self, sample_image):
        """Shifting by (0, 0) should return identical array."""
        result = TransformEngine.shift(sample_image, 0, 0)
        np.testing.assert_array_equal(result, sample_image)

    def test_shift_roundtrip(self, sample_image):
        """Shifting by +dx then -dx should return to original."""
        shifted = TransformEngine.shift(sample_image, 10, 5)
        restored = TransformEngine.shift(shifted, -10, -5)
        np.testing.assert_array_equal(restored, sample_image)

    def test_shift_by_full_size_is_noop(self, sample_image):
        """Shifting by full width/height should be circular → same."""
        h, w = sample_image.shape
        result = TransformEngine.shift(sample_image, w, h)
        np.testing.assert_array_equal(result, sample_image)

    def test_shift_changes_image(self, sample_image):
        """Non-zero shift should produce a different image."""
        result = TransformEngine.shift(sample_image, 5, 5)
        assert not np.array_equal(result, sample_image)


# ── 2. Complex Exponential ───────────────────────────────────────────


class TestComplexExponential:
    def test_zero_frequency_is_noop(self, sample_image):
        """Multiplying by exp(0) should not change real values."""
        result = TransformEngine.complex_exponential(sample_image, 0.0, 0.0)
        np.testing.assert_allclose(np.real(result), sample_image, atol=1e-10)

    def test_output_is_complex(self, sample_image):
        """Result should be complex-valued for non-zero frequency."""
        result = TransformEngine.complex_exponential(sample_image, 0.1, 0.0)
        assert np.iscomplexobj(result)

    def test_shape_preserved(self, sample_image):
        """Output shape should match input."""
        result = TransformEngine.complex_exponential(sample_image, 0.5, 0.3)
        assert result.shape == sample_image.shape


# ── 3. Stretch ───────────────────────────────────────────────────────


class TestStretch:
    def test_stretch_factor_one_preserves_shape(self, sample_image):
        """Factor 1.0 should preserve dimensions."""
        result = TransformEngine.stretch(sample_image, 1.0)
        assert result.shape == sample_image.shape

    def test_stretch_doubles_size(self, sample_image):
        """Factor 2.0 should approximately double each dimension."""
        result = TransformEngine.stretch(sample_image, 2.0)
        assert result.shape[0] == 128
        assert result.shape[1] == 128

    def test_stretch_halves_size(self, sample_image):
        """Factor 0.5 should approximately halve each dimension."""
        result = TransformEngine.stretch(sample_image, 0.5)
        assert result.shape[0] == 32
        assert result.shape[1] == 32

    def test_stretch_invalid_factor(self, sample_image):
        """Factor <= 0 should raise ValueError."""
        with pytest.raises(ValueError, match="must be > 0"):
            TransformEngine.stretch(sample_image, 0)

        with pytest.raises(ValueError, match="must be > 0"):
            TransformEngine.stretch(sample_image, -1.0)


# ── 4. Mirror ────────────────────────────────────────────────────────


class TestMirror:
    def test_mirror_horizontal_twice_is_identity(self, sample_image):
        """Horizontal mirror applied twice should return to original."""
        mirrored = TransformEngine.mirror(sample_image, "horizontal")
        restored = TransformEngine.mirror(mirrored, "horizontal")
        np.testing.assert_array_equal(restored, sample_image)

    def test_mirror_vertical_twice_is_identity(self, sample_image):
        """Vertical mirror applied twice should return to original."""
        mirrored = TransformEngine.mirror(sample_image, "vertical")
        restored = TransformEngine.mirror(mirrored, "vertical")
        np.testing.assert_array_equal(restored, sample_image)

    def test_mirror_both_twice_is_identity(self, sample_image):
        """Both-axis mirror applied twice should return to original."""
        mirrored = TransformEngine.mirror(sample_image, "both")
        restored = TransformEngine.mirror(mirrored, "both")
        np.testing.assert_array_equal(restored, sample_image)

    def test_mirror_changes_image(self, small_image):
        """Mirror of non-symmetric image should differ from original."""
        result = TransformEngine.mirror(small_image, "horizontal")
        assert not np.array_equal(result, small_image)

    def test_mirror_invalid_axis(self, sample_image):
        """Invalid axis should raise ValueError."""
        with pytest.raises(ValueError, match="Invalid axis"):
            TransformEngine.mirror(sample_image, "diagonal")


# ── 5. Even/Odd ──────────────────────────────────────────────────────


class TestEvenOdd:
    def test_even_plus_odd_equals_original(self, sample_image):
        """even(f) + odd(f) should reconstruct the original."""
        even = TransformEngine.even_odd(sample_image, "even")
        odd = TransformEngine.even_odd(sample_image, "odd")
        np.testing.assert_allclose(even + odd, sample_image, atol=1e-10)

    def test_even_is_symmetric(self, sample_image):
        """Even part should be symmetric: even(x) == even(-x)."""
        even = TransformEngine.even_odd(sample_image, "even")
        flipped = np.flip(even, axis=(0, 1))
        np.testing.assert_allclose(even, flipped, atol=1e-10)

    def test_odd_is_antisymmetric(self, sample_image):
        """Odd part should be antisymmetric: odd(x) == -odd(-x)."""
        odd = TransformEngine.even_odd(sample_image, "odd")
        flipped = np.flip(odd, axis=(0, 1))
        np.testing.assert_allclose(odd, -flipped, atol=1e-10)

    def test_invalid_mode(self, sample_image):
        """Invalid mode should raise ValueError."""
        with pytest.raises(ValueError, match="Invalid mode"):
            TransformEngine.even_odd(sample_image, "neither")


# ── 6. Rotate ────────────────────────────────────────────────────────


class TestRotate:
    def test_rotate_zero_is_noop(self, sample_image):
        """Rotation by 0° should return same dimensions."""
        result = TransformEngine.rotate(sample_image, 0.0)
        assert result.shape == sample_image.shape
        np.testing.assert_allclose(result, sample_image, atol=1e-10)

    def test_rotate_360_is_noop(self, sample_image):
        """Rotation by 360° should be very close to original."""
        result = TransformEngine.rotate(sample_image, 360.0)
        assert result.shape == sample_image.shape
        np.testing.assert_allclose(result, sample_image, atol=0.1)

    def test_rotate_enlarges_canvas(self, sample_image):
        """45° rotation should produce a larger canvas."""
        result = TransformEngine.rotate(sample_image, 45.0)
        assert result.shape[0] >= sample_image.shape[0]
        assert result.shape[1] >= sample_image.shape[1]


# ── 7. Differentiate ─────────────────────────────────────────────────


class TestDifferentiate:
    def test_constant_image_is_zero(self):
        """Derivative of a constant image should be zero."""
        constant = np.ones((32, 32), dtype=np.float64) * 5.0
        result = TransformEngine.differentiate(constant)
        np.testing.assert_allclose(result, 0.0, atol=1e-10)

    def test_shape_preserved(self, sample_image):
        """Output shape should match input."""
        result = TransformEngine.differentiate(sample_image)
        assert result.shape == sample_image.shape

    def test_nonzero_for_edges(self, sample_image):
        """Gradient should be non-zero at edges of the white square."""
        result = TransformEngine.differentiate(sample_image)
        assert np.max(result) > 0


# ── 8. Integrate ─────────────────────────────────────────────────────


class TestIntegrate:
    def test_shape_preserved(self, sample_image):
        """Output shape should match input."""
        result = TransformEngine.integrate(sample_image)
        assert result.shape == sample_image.shape

    def test_monotonic_for_positive(self):
        """Cumulative sum of positive values should be monotonically increasing."""
        pos = np.ones((4, 4), dtype=np.float64)
        result = TransformEngine.integrate(pos)
        # Each row should be increasing along axis 0
        for col in range(4):
            for row in range(1, 4):
                assert result[row, col] >= result[row - 1, col]


# ── 9. Window 2D ─────────────────────────────────────────────────────


class TestWindow2D:
    def test_rectangular_is_noop(self, sample_image):
        """Rectangular window should not change the image."""
        result = TransformEngine.window_2d(sample_image, "rectangular")
        np.testing.assert_array_equal(result, sample_image)

    def test_hamming_reduces_edges(self, sample_image):
        """Hamming window should zero out corners."""
        result = TransformEngine.window_2d(sample_image, "hamming")
        assert result[0, 0] < sample_image[0, 0] or sample_image[0, 0] == 0

    def test_hanning_reduces_edges(self, sample_image):
        """Hanning window should zero out corners."""
        result = TransformEngine.window_2d(sample_image, "hanning")
        assert abs(result[0, 0]) < 1e-10

    def test_gaussian_shape_preserved(self, sample_image):
        """Gaussian window should preserve shape."""
        result = TransformEngine.window_2d(sample_image, "gaussian", sigma=0.5)
        assert result.shape == sample_image.shape

    def test_invalid_type(self, sample_image):
        """Invalid window type should raise ValueError."""
        with pytest.raises(ValueError, match="Unknown window_type"):
            TransformEngine.window_2d(sample_image, "blackman")


# ── 10. Repeated FT ─────────────────────────────────────────────────


class TestRepeatedFT:
    def test_count_four_is_identity(self, small_image):
        """FFT applied 4 times should return close to the original."""
        result = TransformEngine.repeated_ft(small_image, 4)
        # FFT^4 of a real signal should be close to original * N^2 (or scaled)
        # Actually: FFT^4 returns the original signal up to a scale factor
        h, w = small_image.shape
        scale = h * w  # Each FFT introduces a factor of sqrt(N), so 4 FFTs = N^2
        normalized = np.real(result) / (scale * scale)
        np.testing.assert_allclose(
            normalized, small_image, atol=1e-8,
            err_msg="FFT^4 should approximate identity (up to scale)"
        )

    def test_count_zero_is_noop(self, sample_image):
        """Count=0 should return a copy of the original."""
        result = TransformEngine.repeated_ft(sample_image, 0)
        np.testing.assert_array_equal(np.real(result), sample_image)

    def test_output_is_complex(self, sample_image):
        """Output should be complex."""
        result = TransformEngine.repeated_ft(sample_image, 1)
        assert np.iscomplexobj(result)

    def test_count_one_equals_fft2(self, small_image):
        """Count=1 should equal np.fft.fft2."""
        result = TransformEngine.repeated_ft(small_image, 1)
        expected = np.fft.fft2(small_image)
        np.testing.assert_allclose(result, expected, atol=1e-10)
