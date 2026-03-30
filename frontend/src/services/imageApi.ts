/**
 * API client for image processing backend.
 *
 * SMART FALLBACK: Probes backend on startup.
 * If unavailable, routes all calls to client-side mock API.
 */

import type {
  SessionResponse,
  ImageSlotResponse,
  FTComponentResponse,
  ResizePolicyRequest,
  ResizePolicyResponse,
  ReconstructResponse,
  VerifyRoundTripResponse,
  FTComponent,
  MixRequest,
  MixResponse,
} from '../types/image';

import * as mock from './mockImageApi';

const BASE_URL = '/api/v1';

let useMock: boolean | null = null;

async function shouldUseMock(): Promise<boolean> {
  if (useMock !== null) return useMock;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${BASE_URL}/session`, { method: 'POST', signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      useMock = false;
      console.log('[imageApi] Backend detected — using real API');
      return false;
    }
  } catch { /* Backend unavailable */ }
  useMock = true;
  console.log('[imageApi] Backend unavailable — using client-side mock');
  return true;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

// ── Session ─────────────────────────────────────────────────────────

export async function createSession(): Promise<SessionResponse> {
  if (await shouldUseMock()) return mock.createSession();
  const res = await fetch(`${BASE_URL}/session`, { method: 'POST' });
  return handleResponse<SessionResponse>(res);
}

// ── Images ──────────────────────────────────────────────────────────

export async function uploadImage(sessionId: string, slot: number, file: File): Promise<ImageSlotResponse> {
  if (useMock) return mock.uploadImage(sessionId, slot, file);
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE_URL}/session/${sessionId}/images/${slot}`, { method: 'POST', body: formData });
  return handleResponse<ImageSlotResponse>(res);
}

export async function getImage(sessionId: string, slot: number, brightness = 0, contrast = 1): Promise<ImageSlotResponse> {
  if (useMock) return mock.getImage(sessionId, slot, brightness, contrast);
  const params = new URLSearchParams({ brightness: brightness.toString(), contrast: contrast.toString() });
  const res = await fetch(`${BASE_URL}/session/${sessionId}/images/${slot}?${params}`);
  return handleResponse<ImageSlotResponse>(res);
}

// ── FT Components ───────────────────────────────────────────────────

export async function getFTComponent(sessionId: string, slot: number, component: FTComponent, brightness = 0, contrast = 1): Promise<FTComponentResponse> {
  if (useMock) return mock.getFTComponent(sessionId, slot, component, brightness, contrast);
  const params = new URLSearchParams({ brightness: brightness.toString(), contrast: contrast.toString() });
  const res = await fetch(`${BASE_URL}/session/${sessionId}/images/${slot}/ft/${component}?${params}`);
  return handleResponse<FTComponentResponse>(res);
}

// ── Resize Policy ───────────────────────────────────────────────────

export async function setResizePolicy(sessionId: string, policy: ResizePolicyRequest): Promise<ResizePolicyResponse> {
  if (useMock) return mock.setResizePolicy(sessionId, policy);
  const res = await fetch(`${BASE_URL}/session/${sessionId}/resize-policy`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(policy) });
  return handleResponse<ResizePolicyResponse>(res);
}

export async function getResizePolicy(sessionId: string): Promise<ResizePolicyResponse> {
  if (useMock) return mock.getResizePolicy(sessionId);
  const res = await fetch(`${BASE_URL}/session/${sessionId}/resize-policy`);
  return handleResponse<ResizePolicyResponse>(res);
}

// ── Reconstruction ──────────────────────────────────────────────────

export async function reconstructImage(sessionId: string, slot: number): Promise<ReconstructResponse> {
  if (useMock) return mock.reconstructImage(sessionId, slot);
  const res = await fetch(`${BASE_URL}/session/${sessionId}/images/${slot}/reconstruct`, { method: 'POST' });
  return handleResponse<ReconstructResponse>(res);
}

export async function verifyRoundTrip(sessionId: string, slot: number): Promise<VerifyRoundTripResponse> {
  if (useMock) return mock.verifyRoundTrip(sessionId, slot);
  const res = await fetch(`${BASE_URL}/session/${sessionId}/images/${slot}/verify-roundtrip`);
  return handleResponse<VerifyRoundTripResponse>(res);
}

// ── Mixing ──────────────────────────────────────────────────────────

export async function mixImages(sessionId: string, request: MixRequest, onProgress: (pct: number) => void): Promise<MixResponse> {
  // Always use mock for mixing since we have full client-side FFT support
  return mock.mixImages(sessionId, request, onProgress);
}

export function cancelMix(): void {
  mock.cancelMix();
}
