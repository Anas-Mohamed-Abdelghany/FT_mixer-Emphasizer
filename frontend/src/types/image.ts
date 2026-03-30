/**
 * TypeScript interfaces for the image processing application.
 */

// ── API Response Types ──────────────────────────────────────────────

export interface SessionResponse {
  session_id: string;
}

export interface ImageSlotResponse {
  slot: number;
  filename: string;
  width: number;
  height: number;
  preview: string; // base64 PNG
}

export interface FTComponentResponse {
  slot: number;
  component: string;
  image: string; // base64 PNG
}

export interface ResizePolicyRequest {
  mode: 'smallest' | 'largest' | 'fixed';
  fixed_width?: number;
  fixed_height?: number;
  preserve_aspect: boolean;
}

export interface ResizePolicyResponse {
  mode: string;
  fixed_width?: number;
  fixed_height?: number;
  preserve_aspect: boolean;
  target_width?: number;
  target_height?: number;
  affected_slots: number[];
}

export interface ReconstructResponse {
  slot: number;
  image: string; // base64 PNG
}

export interface VerifyRoundTripResponse {
  slot: number;
  max_error: number;
  passed: boolean;
}

export type FTComponent = 'magnitude' | 'phase' | 'real' | 'imaginary';

// ── Mixer Types ─────────────────────────────────────────────────────

export interface ViewportPairProps {
  sessionId: string;
  slot: number;
  isInput: boolean;
  onImageLoaded?: (slot: number) => void;
}

export type OutputTarget = 0 | 1;

export interface ResizePolicyState {
  mode: 'smallest' | 'largest' | 'fixed';
  fixedWidth: number;
  fixedHeight: number;
  preserveAspect: boolean;
}

export interface ViewportState {
  sessionId: string;
  slot: number;
  activeComponent: 'spatial' | FTComponent;
  brightness: number;
  contrast: number;
  imageSrc: string | null;
  filename: string;
  width: number;
  height: number;
}

export type MixMode = 'mag-phase' | 'real-imag';

export interface ImageWeight {
  componentA: number; // magnitude or real
  componentB: number; // phase or imaginary
}

export interface MixerState {
  mode: MixMode;
  weights: ImageWeight[];
  regionSize: number;        // 0–100%
  regionType: 'inner' | 'outer';
  simulateSlow: boolean;
}

// ── Mixing API Types ────────────────────────────────────────────────

export interface MixRequest {
  mode: MixMode;
  weights: ImageWeight[];
  region_size: number;
  region_type: 'inner' | 'outer';
  output_slot: number;
  simulate_slow: boolean;
}

export interface MixResponse {
  output_slot: number;
  preview: string; // base64 PNG
  width: number;
  height: number;
}

// ── Emphasizer Types ────────────────────────────────────────────────

export type EmphasizerAction =
  | 'shift'
  | 'complex-exponential'
  | 'stretch'
  | 'mirror'
  | 'even-odd'
  | 'rotate'
  | 'differentiate'
  | 'integrate'
  | 'window'
  | 'multiple-ft';

export type WindowType = 'rectangular' | 'gaussian' | 'hamming' | 'hanning';

export interface EmphasizerParams {
  // Shift
  shiftX: number;
  shiftY: number;
  // Complex exponential
  expU: number;
  expV: number;
  // Stretch
  stretchFactor: number;
  // Mirror
  mirrorAxis: 'horizontal' | 'vertical' | 'both';
  // Even/Odd
  evenOddType: 'even' | 'odd';
  // Rotate
  rotateAngle: number;
  // Differentiate
  diffDirection: 'x' | 'y' | 'both';
  // Integrate
  intDirection: 'x' | 'y' | 'both';
  // Window
  windowType: WindowType;
  windowWidthRatio: number;
  windowHeightRatio: number;
  windowSigma: number;
  // Multiple FT
  ftCount: number;
  // Domain
  applyInFrequency: boolean;
}

export type AppMode = 'mixer' | 'emphasizer';
