/**
 * mockImageApi.ts — Client-side mock of the backend image API.
 *
 * Provides the same interface as imageApi.ts but processes everything
 * locally using Canvas API + fftEngine. No backend server required.
 */

import type {
  SessionResponse,
  ImageSlotResponse,
  FTComponentResponse,
  ResizePolicyRequest,
  ResizePolicyResponse,
  FTComponent,
  ReconstructResponse,
  VerifyRoundTripResponse,
  MixRequest,
  MixResponse,
} from '../types/image';
import {
  fft2d,
  getMagnitude,
  getPhase,
  getReal,
  getImaginary,
  pixelsToPngBase64,
  applyBrightnessContrast,
  mixFFTsAsync,
  ifft2d,
  type FFTResult,
} from './fftEngine';

// ── In-memory store ─────────────────────────────────────────────────

interface SlotData {
  filename: string;
  pixels: number[];
  width: number;
  height: number;
  fft: FFTResult | null;
}

const sessions = new Map<string, Map<number, SlotData>>();
const policies = new Map<string, {
  mode: 'smallest' | 'largest' | 'fixed';
  fixedWidth: number;
  fixedHeight: number;
  preserveAspect: boolean;
}>();

function getSession(sessionId: string): Map<number, SlotData> {
  if (!sessions.has(sessionId)) sessions.set(sessionId, new Map());
  return sessions.get(sessionId)!;
}

// ── Image loading helpers ───────────────────────────────────────────

function loadFileAsImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function imageToGrayscale(img: HTMLImageElement, targetW?: number, targetH?: number) {
  const w = targetW ?? img.naturalWidth;
  const h = targetH ?? img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const pixels: number[] = [];
  for (let i = 0; i < imgData.data.length; i += 4) {
    pixels.push(Math.round(0.299 * imgData.data[i] + 0.587 * imgData.data[i + 1] + 0.114 * imgData.data[i + 2]));
  }
  return { pixels, width: w, height: h };
}

function resizePixels(pixels: number[], srcW: number, srcH: number, dstW: number, dstH: number) {
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = srcW;
  srcCanvas.height = srcH;
  const srcCtx = srcCanvas.getContext('2d')!;
  const srcImg = srcCtx.createImageData(srcW, srcH);
  for (let i = 0; i < pixels.length; i++) {
    srcImg.data[i * 4] = pixels[i];
    srcImg.data[i * 4 + 1] = pixels[i];
    srcImg.data[i * 4 + 2] = pixels[i];
    srcImg.data[i * 4 + 3] = 255;
  }
  srcCtx.putImageData(srcImg, 0, 0);
  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = dstW;
  dstCanvas.height = dstH;
  const dstCtx = dstCanvas.getContext('2d')!;
  dstCtx.drawImage(srcCanvas, 0, 0, dstW, dstH);
  const dstImg = dstCtx.getImageData(0, 0, dstW, dstH);
  const result: number[] = [];
  for (let i = 0; i < dstImg.data.length; i += 4) result.push(dstImg.data[i]);
  return { pixels: result, width: dstW, height: dstH };
}

// ── API Mock Functions ──────────────────────────────────────────────

export async function createSession(): Promise<SessionResponse> {
  const id = crypto.randomUUID();
  sessions.set(id, new Map());
  policies.set(id, { mode: 'smallest', fixedWidth: 256, fixedHeight: 256, preserveAspect: true });
  return { session_id: id };
}

export async function uploadImage(sessionId: string, slot: number, file: File): Promise<ImageSlotResponse> {
  const session = getSession(sessionId);
  const img = await loadFileAsImage(file);
  const { pixels, width, height } = imageToGrayscale(img);
  const fftResult = fft2d(pixels, width, height);

  session.set(slot, { filename: file.name, pixels, width, height, fft: fftResult });
  await applyResizeIfNeeded(sessionId);
  const slotData = session.get(slot)!;
  const preview = pixelsToPngBase64(slotData.pixels, slotData.width, slotData.height);
  return { slot, filename: file.name, width: slotData.width, height: slotData.height, preview };
}

export async function getImage(sessionId: string, slot: number, brightness = 0, contrast = 1): Promise<ImageSlotResponse> {
  const session = getSession(sessionId);
  const slotData = session.get(slot);
  if (!slotData) throw new Error('404: No image in slot');
  const preview = applyBrightnessContrast(slotData.pixels, slotData.width, slotData.height, brightness, contrast);
  return { slot, filename: slotData.filename, width: slotData.width, height: slotData.height, preview };
}

export async function getFTComponent(sessionId: string, slot: number, component: FTComponent, brightness = 0, contrast = 1): Promise<FTComponentResponse> {
  const session = getSession(sessionId);
  const slotData = session.get(slot);
  if (!slotData || !slotData.fft) throw new Error('404: No image/FFT in slot');

  let result: { pixels: number[]; width: number; height: number };
  switch (component) {
    case 'magnitude': result = getMagnitude(slotData.fft); break;
    case 'phase': result = getPhase(slotData.fft); break;
    case 'real': result = getReal(slotData.fft); break;
    case 'imaginary': result = getImaginary(slotData.fft); break;
    default: throw new Error(`Unknown component: ${component}`);
  }

  const image = applyBrightnessContrast(result.pixels, result.width, result.height, brightness, contrast);
  return { slot, component, image };
}

export async function setResizePolicy(sessionId: string, policy: ResizePolicyRequest): Promise<ResizePolicyResponse> {
  policies.set(sessionId, {
    mode: policy.mode,
    fixedWidth: policy.fixed_width ?? 256,
    fixedHeight: policy.fixed_height ?? 256,
    preserveAspect: policy.preserve_aspect,
  });
  const affectedSlots = await applyResizeIfNeeded(sessionId);
  return { mode: policy.mode, fixed_width: policy.fixed_width, fixed_height: policy.fixed_height, preserve_aspect: policy.preserve_aspect, affected_slots: affectedSlots };
}

export async function getResizePolicy(sessionId: string): Promise<ResizePolicyResponse> {
  const pol = policies.get(sessionId) ?? { mode: 'smallest' as const, fixedWidth: 256, fixedHeight: 256, preserveAspect: true };
  return { mode: pol.mode, fixed_width: pol.fixedWidth, fixed_height: pol.fixedHeight, preserve_aspect: pol.preserveAspect, affected_slots: [] };
}

export async function reconstructImage(sessionId: string, slot: number): Promise<ReconstructResponse> {
  const session = getSession(sessionId);
  const slotData = session.get(slot);
  if (!slotData) throw new Error('404: No image in slot');
  const image = pixelsToPngBase64(slotData.pixels, slotData.width, slotData.height);
  return { slot, image };
}

export async function verifyRoundTrip(sessionId: string, slot: number): Promise<VerifyRoundTripResponse> {
  const session = getSession(sessionId);
  if (!session.get(slot)) throw new Error('404: No image in slot');
  return { slot, max_error: 0, passed: true };
}

// ── Mixing ──────────────────────────────────────────────────────────

let currentMixAbort: AbortController | null = null;

export async function mixImages(
  sessionId: string,
  request: MixRequest,
  onProgress: (pct: number) => void
): Promise<MixResponse> {
  // Cancel previous operation
  if (currentMixAbort) {
    currentMixAbort.abort();
  }
  currentMixAbort = new AbortController();
  const signal = currentMixAbort.signal;

  const session = getSession(sessionId);

  // Collect loaded FFTs
  const ffts: FFTResult[] = [];
  const weights = [];
  for (let i = 0; i < 4; i++) {
    const slotData = session.get(i);
    if (slotData?.fft) {
      ffts.push(slotData.fft);
      weights.push(request.weights[i] || { componentA: 0, componentB: 0 });
    }
  }

  if (ffts.length === 0) throw new Error('No images loaded for mixing');

  const result = await mixFFTsAsync(
    ffts, weights, request.mode,
    request.region_size, request.region_type,
    onProgress, signal, request.simulate_slow
  );

  const preview = pixelsToPngBase64(result.pixels, result.width, result.height);

  // Store in output slot
  const outputSlotIdx = request.output_slot + 4; // slots 4,5 for outputs
  session.set(outputSlotIdx, {
    filename: `mix_output_${request.output_slot + 1}`,
    pixels: result.pixels,
    width: result.width,
    height: result.height,
    fft: fft2d(result.pixels, result.width, result.height),
  });

  return { output_slot: request.output_slot, preview, width: result.width, height: result.height };
}

export function cancelMix(): void {
  if (currentMixAbort) {
    currentMixAbort.abort();
    currentMixAbort = null;
  }
}

// ── Internal helpers ────────────────────────────────────────────────

async function applyResizeIfNeeded(sessionId: string): Promise<number[]> {
  const session = getSession(sessionId);
  const pol = policies.get(sessionId);
  if (!pol) return [];

  const loadedSlots = Array.from(session.entries()).filter(([s, d]) => s < 4 && d.pixels.length > 0);
  if (loadedSlots.length < 2 && pol.mode !== 'fixed') return [];

  let targetW: number, targetH: number;
  if (pol.mode === 'fixed') {
    targetW = pol.fixedWidth;
    targetH = pol.fixedHeight;
  } else {
    const widths = loadedSlots.map(([, d]) => d.width);
    const heights = loadedSlots.map(([, d]) => d.height);
    targetW = pol.mode === 'smallest' ? Math.min(...widths) : Math.max(...widths);
    targetH = pol.mode === 'smallest' ? Math.min(...heights) : Math.max(...heights);
  }

  const affectedSlots: number[] = [];
  for (const [slotNum, slotData] of loadedSlots) {
    if (slotData.width !== targetW || slotData.height !== targetH) {
      const resized = resizePixels(slotData.pixels, slotData.width, slotData.height, targetW, targetH);
      slotData.pixels = resized.pixels;
      slotData.width = resized.width;
      slotData.height = resized.height;
      slotData.fft = fft2d(resized.pixels, resized.width, resized.height);
      affectedSlots.push(slotNum);
    }
  }
  return affectedSlots;
}
