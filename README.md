<div align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=FastAPI&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/NumPy-013243?style=for-the-badge&logo=numpy&logoColor=white" alt="NumPy" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <h1>FT Mixer & Properties Emphasizer</h1>
  <p><i>A powerful, mathematical sandbox for exploring the discrete Fourier Transform (FT) of images, visualizing complex frequency components, and testing signal processing properties in real-time.</i></p>
</div>

<p align="center">
  <img src="https://github.com/user-attachments/assets/6db1a2b7-7578-4c78-94d4-2bf484a6436f" width="45%" />
  <img src="https://github.com/user-attachments/assets/c42c08ad-079c-4b44-b23c-59d8bc5252a7" width="45%" />
</p>

---

## 📖 Overview

The **FT Mixer & Properties Emphasizer** provides an intuitive, highly decoupled platform to visually understand image frequencies. It supports loading multiple images, intricately resolving shape mismatches using configurable policies, and seamlessly applying dense matrix transformations (e.g., convolution, rotation, and complex exponential shifts) without blocking the UI.

This project was built from the ground up prioritizing mathematical purity — the Fast Fourier Transforms (FFT) and image pipelines strictly run via NumPy and SciPy in a decoupled asynchronous backend.

## 📸 Interface Showcases

<p align="center">
  <img src="https://github.com/user-attachments/assets/85d0437c-21e2-43dc-a58c-7bd956d3d2b3" width="45%" />
  <img src="https://github.com/user-attachments/assets/8142dc2d-2a73-479e-a46e-1de416f8518e" width="45%" />
</p>

---

## ✨ Core Features & Technical Deep Dive

### 🖼️ 1. Multi-Image Viewports & Interactivity
- **4-Slot Workspace:** Manage up to 4 concurrent images. Viewports run completely independently using a session-based (`UUID`) React architecture.
- **Grayscale Normalization:** Uploaded images are strictly converted to pure `float64` 2D arrays, avoiding RGB channel processing complexity during transformations.
- **Dynamic Mouse Controls:** Click and drag on any viewport to locally tweak brightness (offset) and contrast (scaling).

### 📐 2. Smart Resize Constraints
Handling matrix operations across misaligned array sizes requires strict shape resolution. 
- **Global Scaling Rulebook:** Toggle between *Smallest Extents*, *Largest Extents*, or *Fixed Exact Values*.
- **Interpolation:** The `ResizePolicy` engine dynamically computes and triggers `ndimage.zoom` with optional Aspect Ratio preservation to prepare matrices before passing them to the Mixer.

### 🔍 3. Unpacked Fourier Components
Compute the 2D spatial FFT, cache the complex plane, and rapidly serve independent modes:
- **Magnitude:** View the signal's energy distribution. Automatically log-scaled (`log(1 + |X|)`), shifted, and peak-normalized.
- **Phase:** View the phase angle structure (`angle(X)`), wrapped from `[-π, π]` into a normalized `0..1` scale.
- **Real & Imaginary:** Directly view the raw complex components mapped spatially.

### 🎛️ 4. The `MixingEngine` Sandbox
Mix images from 4 independent slots using 2 distinct polar or rectangular mapping modes:
- **Mag-Phase Mixing:** Combines layers via $`|X_{mix}| \cdot e^{j \cdot \phi_{mix}}`$. Independently control weight percentages (`0-100%`) for the Magnitude arrays and Phase arrays.
- **Real-Imag Mixing:** Combines layers linearly via rectangular representation ($`(w_r \cdot \Re) + j(w_i \cdot \Im)`$).
- **Frequency Region Masking:** Use percentage sliders to generate an `Inner` (low-pass) or `Outer` (high-pass) topological mask applied as an element-wise multiplication during the mix matrix assembly.

### 🔬 5. The Properties Emphasizer
Ten strictly enforced static digital signal processing transformations. Apply them on the Spatial domain, or flip to the Frequency domain to see profound duality effects:
1. **Linear Shift:** 2D translation via `np.roll`.
2. **Complex Exponential:** Modulates by $`e^{j \cdot 2\pi (f_x x/W + f_y y/H)}`$, causing dramatic spectrum shifts.
3. **Stretch:** Decimations and interpolations via third-order spline resampling.
4. **Mirror Symmetry:** Applies kaleidoscope mirroring (Left-to-Right, Top-to-Bottom, or Both).
5. **Even/Odd Decomposition:** Decomposes signals using $`(x(t) \pm x(-t))/2`$.
6. **2D Rotation:** Pure coordinate rotation.
7. **Differentiation:** Computes complex gradients ($`X, Y, Magnitude`$).
8. **Integration:** Computes spatial cumulative sums.
9. **Sliding-Window Convolution:** O(n) separable 1D passes (`ndimage.convolve1d`) over the matrix using configurable **Rectangular, Gaussian, Hamming,** and **Hanning** kernels with custom strides and mode settings (`Same` vs `Valid`).
10. **Repeated FT Iterations:** Iteratively triggers `scipy.fft2` $`N`$ times, visually proving Fourier duality (e.g. 4 iterations yield the exact starting image).

### 🔄 6. Round-Trip Reconstructor
- Push frequency data backward through the Inverse Fourier Transform (`np.fft.ifft2()`).
- The built-in mathematical engine cross-references the reconstructed spatial image against original data slots to verify that data loss ($`max(|\Delta|)`$) does not exceed `1e-6`.

---

## 🚀 The Tech Stack

**Frontend Framework:**
- **React.js & TypeScript:** Statically-typed data structures matching the backend Pydantic models.
- **Vite:** High velocity Hot-Module Reloading (HMR).
- **Tailwind CSS:** Fully programmatic and flex-based styling.

**Backend Engine:**
- **FastAPI:** Non-blocking async endpoints managing websocket progress streams.
- **Python Threads:** Emphasizer jobs are queued as background threads avoiding main loop blocks.
- **NumPy & SciPy.fft:** Heavy, optimized C-bound mathematical structures (`ndimage`, `signal.windows`).

---

## 🛠️ Installation & Getting Started

### 1. Booting the Server Engine (Backend)
1. In your terminal, navigate directly to the root of the project.
2. Initialize and activate a virtual environment:
   ```bash
   python -m venv backend/venv
   
   # For Windows (PowerShell):
   .\backend\venv\Scripts\Activate.ps1
   
   # For Mac/Linux:
   source backend/venv/bin/activate
   ```
3. Install package requirements:
   ```bash
   pip install -r backend/requirements.txt
   ```
4. Mount the FastAPI uvicorn daemon:
   ```bash
   uvicorn backend.main:app --reload
   ```
   *The server responds at `http://127.0.0.1:8000`.*

### 2. Booting the UI Server (Frontend)
1. Open up a secondary, freshly spawned terminal.
2. Move into the Vite workspace:
   ```bash
   cd frontend
   ```
3. Fetch NPM modules:
   ```bash
   npm install
   ```
4. Launch the local dev service:
   ```bash
   npm run dev
   ```
   *Interactive application exposed at `http://localhost:5173`.*

---

## 🧪 Validating the Mathematics

No properties emphasizer is complete without unit tests validating the matrix operations.
With your virtual environment active, trigger the test suite:

```bash
python -m pytest backend/tests/ -v
```

This suite comprehensively proves roundtrip reconstruction purity, bounds limits, and properties symmetry handling over arrays.

---

<div align="center">
  <b>Developed for SBEG 2025/Spring 2026.</b>
</div>
