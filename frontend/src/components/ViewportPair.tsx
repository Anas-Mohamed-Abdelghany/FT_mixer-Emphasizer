/**
 * ViewportPair.tsx — Pairs a spatial viewport and an FT viewport for one image slot.
 */

import { useState, useCallback } from 'react';
import { ViewportComponent } from './ViewportComponent';
import type { FTComponent } from '../types/image';

interface ViewportPairProps {
  sessionId: string;
  slot: number;
  isInput: boolean;
  onImageLoaded?: (slot: number) => void;
  highlighted?: boolean;
  regionOverlay?: { size: number; type: 'inner' | 'outer' };
  /** External image source for output viewports (base64 data URL) */
  externalSpatialSrc?: string | null;
}

export function ViewportPair({ sessionId, slot, isInput, onImageLoaded, highlighted, regionOverlay, externalSpatialSrc }: ViewportPairProps) {
  const [activeComponent, setActiveComponent] = useState<FTComponent>('magnitude');
  const [resetKey, setResetKey] = useState(0);

  const handleFTChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setActiveComponent(e.target.value as FTComponent);
  };

  const handleImageLoadedInternal = useCallback((_slot: number, _filename: string) => {
    onImageLoaded?.(slot);
  }, [slot, onImageLoaded]);

  const handleReset = () => {
    setResetKey(prev => prev + 1);
  };

  return (
    <div className={`viewport-pair ${highlighted ? 'highlighted' : ''}`}>
      {/* Reset Button */}
      <button onClick={handleReset} title="Reset Brightness/Contrast" className="viewport-pair-reset">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      <div className="viewport-pair-grid">
        {/* Spatial Display */}
        <ViewportComponent
          key={`spatial-${resetKey}`}
          sessionId={sessionId}
          slot={slot}
          label={isInput ? `In ${slot + 1} S` : `Out ${slot - 3} S`}
          allowUpload={isInput}
          viewMode="spatial"
          hideDropdown={true}
          onImageLoaded={handleImageLoadedInternal}
          externalSrc={externalSpatialSrc}
        />

        {/* FT Display */}
        <div className="viewport-ft-wrapper">
          <ViewportComponent
            key={`ft-${resetKey}`}
            sessionId={sessionId}
            slot={slot}
            label={isInput ? `In ${slot + 1} FT` : `Out ${slot - 3} FT`}
            allowUpload={false}
            viewMode={activeComponent}
            hideDropdown={true}
            regionOverlay={regionOverlay}
          />
          {/* FT Dropdown Overlay */}
          <div className="viewport-ft-dropdown">
            <select value={activeComponent} onChange={handleFTChange} className="viewport-ft-select">
              <option value="magnitude">Mag</option>
              <option value="phase">Phs</option>
              <option value="real">Real</option>
              <option value="imaginary">Imag</option>
            </select>
          </div>
        </div>
      </div>

      {!isInput && !highlighted && (
        <div className="viewport-pair-no-result">
          <span>No mixing result</span>
        </div>
      )}
    </div>
  );
}
