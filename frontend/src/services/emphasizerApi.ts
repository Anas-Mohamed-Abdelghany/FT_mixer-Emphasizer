/**
 * API client for the Emphasizer backend endpoints.
 *
 * Provides typed functions for:
 *  - Submitting transform operations
 *  - Streaming progress via SSE (EventSource)
 *  - Fetching completed transform results
 */

const BASE_URL = '/api/v1';

// ── Types ───────────────────────────────────────────────────────────

export interface TransformRequest {
  operation: string;
  params: Record<string, unknown>;
  domain: 'spatial' | 'frequency';
  slot: number;
}

export interface TransformResponse {
  request_id: number;
}

export interface TransformResultResponse {
  request_id: number;
  preview: string;       // base64 PNG spatial
  ft_preview: string;    // base64 PNG FT
  width: number;
  height: number;
}

export interface ProgressEvent {
  request_id: number;
  progress: number;      // 0.0–1.0
}

// ── Helper ──────────────────────────────────────────────────────────

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

// ── API Functions ───────────────────────────────────────────────────

/**
 * Submit a transform operation for background execution.
 */
export async function applyTransform(
  sessionId: string,
  request: TransformRequest,
  signal?: AbortSignal,
): Promise<TransformResponse> {
  const res = await fetch(`${BASE_URL}/session/${sessionId}/transform`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });
  return handleResponse<TransformResponse>(res);
}

/**
 * Connect to the SSE progress endpoint.
 *
 * Returns a cleanup function to close the connection.
 */
export function connectProgress(
  sessionId: string,
  onProgress: (event: ProgressEvent) => void,
  onComplete: () => void,
  onError?: (error: Event) => void,
): () => void {
  const url = `${BASE_URL}/session/${sessionId}/progress`;
  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const data: ProgressEvent = JSON.parse(event.data);
      onProgress(data);

      if (data.progress >= 1.0) {
        eventSource.close();
        onComplete();
      }
    } catch {
      // Ignore parse errors
    }
  };

  eventSource.onerror = (event) => {
    eventSource.close();
    onError?.(event);
  };

  return () => eventSource.close();
}

/**
 * Fetch the result of a completed transform.
 */
export async function getTransformResult(
  sessionId: string,
  requestId: number,
  signal?: AbortSignal,
): Promise<TransformResultResponse> {
  const res = await fetch(
    `${BASE_URL}/session/${sessionId}/transform-result/${requestId}`,
    { signal },
  );
  return handleResponse<TransformResultResponse>(res);
}

/**
 * Toggle bottleneck simulation on the backend.
 */
export async function toggleBottleneck(
  sessionId: string,
  enabled: boolean,
): Promise<void> {
  await fetch(`${BASE_URL}/session/${sessionId}/bottleneck`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
}
