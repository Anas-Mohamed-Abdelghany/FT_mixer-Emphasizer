/**
 * emphasisEngine.ts — Optimized client-side emphasis transforms.
 *
 * Uses Float64Array throughout to avoid GC pressure from object allocations.
 * Convolution uses separable passes for O(n*k) instead of O(n*k²).
 * FFT operations use the flat-array API to avoid Complex[] ↔ Float64Array conversion.
 */

import type { Complex } from './fftEngine';
import { fft2dFromFlat, ifft2dFromFlat, fftShiftFlat, complexAbs } from './fftEngine';

export interface ComplexImage {
  real: Float64Array;
  imag: Float64Array;
  width: number;
  height: number;
}

export function createComplexFromGrayscale(pixels: number[], w: number, h: number): ComplexImage {
  const real = new Float64Array(w * h);
  const imag = new Float64Array(w * h);
  for (let i = 0; i < pixels.length; i++) real[i] = pixels[i];
  return { real, imag, width: w, height: h };
}

export function complexImageToPixels(img: ComplexImage, component: 'magnitude' | 'phase' | 'real' | 'imaginary', isFreq: boolean = false): number[] {
  const n = img.width * img.height;
  const raw = new Float64Array(n);

  switch (component) {
    case 'magnitude':
      for (let i = 0; i < n; i++) {
        const mag = Math.sqrt(img.real[i] ** 2 + img.imag[i] ** 2);
        raw[i] = isFreq ? 20 * Math.log10(1 + mag) : mag;
      }
      break;
    case 'phase': {
      const result = new Array(n);
      for (let i = 0; i < n; i++) {
        const v = Math.atan2(img.imag[i], img.real[i]);
        result[i] = Math.round(((v + Math.PI) / (2 * Math.PI)) * 255);
      }
      return result;
    }
    case 'real':
      for (let i = 0; i < n; i++) raw[i] = img.real[i];
      break;
    case 'imaginary':
      for (let i = 0; i < n; i++) raw[i] = img.imag[i];
      break;
  }

  let min = Infinity, max = -Infinity;
  for (let i = 0; i < n; i++) {
    if (raw[i] < min) min = raw[i];
    if (raw[i] > max) max = raw[i];
  }

  // Frequency magnitude uses max-normalization (ignores dynamic minimum) to match backend
  if (component === 'magnitude' && isFreq) {
    min = 0;
  }

  const range = max - min || 1;
  const result = new Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = Math.round(((raw[i] - min) / range) * 255);
  }
  return result;
}



export function computeFT(img: ComplexImage): ComplexImage {
  const result = fft2dFromFlat(img.real, img.imag, img.width, img.height);
  return { real: result.re, imag: result.im, width: result.cols, height: result.rows };
}

export function computeIFT(img: ComplexImage): ComplexImage {
  const result = ifft2dFromFlat(img.real, img.imag, img.width, img.height);
  return { real: result.re, imag: result.im, width: result.cols, height: result.rows };
}

export function complexToDisplayPixels(
  img: ComplexImage,
  component: 'magnitude' | 'phase' | 'real' | 'imaginary',
  isFreq: boolean = false
): number[] {
  return complexImageToPixels(img, component, isFreq);
}

export function shiftComplexImage(img: ComplexImage): ComplexImage {
  const { width: w, height: h } = img;
  const result = fftShiftFlat(img.real, img.imag, h, w);
  return { real: result.re, imag: result.im, width: w, height: h };
}

export function loadFileAsComplexImage(file: File): Promise<{ img: ComplexImage; pixels: number[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const htmlImg = new Image();
      htmlImg.onload = () => {
        const w = htmlImg.naturalWidth;
        const h = htmlImg.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(htmlImg, 0, 0);
        const data = ctx.getImageData(0, 0, w, h);
        const pixels: number[] = [];
        for (let i = 0; i < data.data.length; i += 4) {
          pixels.push(Math.round(0.299 * data.data[i] + 0.587 * data.data[i + 1] + 0.114 * data.data[i + 2]));
        }
        const img = createComplexFromGrayscale(pixels, w, h);
        resolve({ img, pixels });
      };
      htmlImg.onerror = reject;
      htmlImg.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function complexImageToPngBase64(img: ComplexImage, component: 'magnitude' | 'phase' | 'real' | 'imaginary', isFreq: boolean = false): string {
  const pixels = complexToDisplayPixels(img, component, isFreq);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(img.width, img.height);
  for (let i = 0; i < pixels.length; i++) {
    const v = Math.max(0, Math.min(255, pixels[i]));
    imgData.data[i * 4] = v;
    imgData.data[i * 4 + 1] = v;
    imgData.data[i * 4 + 2] = v;
    imgData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

export function complexImageToFTPngBase64(img: ComplexImage, component: 'magnitude' | 'phase' | 'real' | 'imaginary'): string {
  const shifted = shiftComplexImage(img);
  return complexImageToPngBase64(shifted, component, true);
}

export { complexAbs };
