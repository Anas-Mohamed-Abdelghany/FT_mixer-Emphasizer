/**
 * ModeSwitcher.tsx — Toggle between Mixer and Emphasizer modes.
 *
 * Extracted from App.tsx for reusability (Constitution §III).
 */

import type { AppMode } from '../types/image';

interface ModeSwitcherProps {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
}

export function ModeSwitcher({ mode, onChange }: ModeSwitcherProps) {
  return (
    <nav className="mode-switcher">
      <button
        className={`mode-btn ${mode === 'mixer' ? 'active' : ''}`}
        onClick={() => onChange('mixer')}
      >
        <svg className="mode-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        Part A — Mixer
      </button>
      <button
        className={`mode-btn ${mode === 'emphasizer' ? 'active' : ''}`}
        onClick={() => onChange('emphasizer')}
      >
        <svg className="mode-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Part B — Emphasizer
      </button>
    </nav>
  );
}
