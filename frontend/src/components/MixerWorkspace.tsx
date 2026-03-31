/**
 * MixerWorkspace.tsx — Part A: Full FT Magnitude/Phase Mixer.
 *
 * Layout:
 *  - 4 input viewport pairs (spatial + FT with dropdown)
 *  - Components mixer panel (weight sliders, region controls, progress)
 *  - Output target selector
 *  - 2 output viewport pairs
 */

import { useState, useCallback, useRef } from 'react';
import { useSession } from '../hooks/useSession';
import { ViewportPair } from './ViewportPair';
import { OutputTargetSelector } from './OutputTargetSelector';
import { ResizePolicyPanel } from './ResizePolicyPanel';
import { ComponentsMixer } from './ComponentsMixer';
import { mixImages } from '../services/imageApi';
import type { OutputTarget, MixMode, ImageWeight } from '../types/image';

let activeMixAbort: AbortController | null = null;

export function MixerWorkspace() {
  const { sessionId, loading, error } = useSession();
  const [activeOutputTarget, setActiveOutputTarget] = useState<OutputTarget>(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadedSlots, setLoadedSlots] = useState([false, false, false, false]);
  const [mixProgress, setMixProgress] = useState<number | null>(null);
  const [outputImages, setOutputImages] = useState<(string | null)[]>([null, null]);
  const [regionOverlay, setRegionOverlay] = useState<{ size: number; type: 'inner' | 'outer' }>({ size: 100, type: 'inner' });
  const mixingRef = useRef(false);

  const handleRegionChange = useCallback((size: number, type: 'inner' | 'outer') => {
    setRegionOverlay({ size, type });
  }, []);

  const handleImageLoaded = useCallback((slot: number) => {
    console.log(`Image loaded in slot ${slot}`);
    setLoadedSlots(prev => {
      const next = [...prev];
      next[slot] = true;
      return next;
    });
    setRefreshKey(prev => prev + 1);
  }, []);

  const handlePolicyChanged = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const handleMix = useCallback(async (
    mode: MixMode,
    weights: ImageWeight[],
    regionSize: number,
    regionType: 'inner' | 'outer',
    simulateSlow: boolean
  ) => {
    if (!sessionId) return;

    // Cancel any in-flight mix
    if (activeMixAbort) {
      activeMixAbort.abort();
      activeMixAbort = null;
    }

    const abortController = new AbortController();
    activeMixAbort = abortController;
    mixingRef.current = true;
    setMixProgress(0);
    setRegionOverlay({ size: regionSize, type: regionType });

    // Simulate incremental progress while waiting for backend
    let progressValue = 0;
    const progressInterval = setInterval(() => {
      if (abortController.signal.aborted) {
        clearInterval(progressInterval);
        return;
      }
      // Incrementally approach 90% (never reach 100 until done)
      progressValue = Math.min(90, progressValue + (90 - progressValue) * 0.08);
      setMixProgress(progressValue);
    }, 200);

    try {
      const result = await mixImages(sessionId, {
        mode,
        weights,
        region_size: regionSize,
        region_type: regionType,
        output_slot: activeOutputTarget,
        simulate_slow: simulateSlow,
      }, (pct) => {
        setMixProgress(pct);
      }, abortController.signal);

      clearInterval(progressInterval);
      setMixProgress(100);

      const imgSrc = `data:image/png;base64,${result.preview}`;
      setOutputImages(prev => {
        const next = [...prev];
        next[activeOutputTarget] = imgSrc;
        return next;
      });
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      clearInterval(progressInterval);
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.log('Mix cancelled');
      } else {
        console.error('Mix failed:', err);
      }
    } finally {
      if (activeMixAbort === abortController) {
        activeMixAbort = null;
      }
      mixingRef.current = false;
      setMixProgress(null);
    }
  }, [sessionId, activeOutputTarget]);

  const handleCancelMix = useCallback(() => {
    if (activeMixAbort) {
      activeMixAbort.abort();
      activeMixAbort = null;
    }
    mixingRef.current = false;
    setMixProgress(null);
  }, []);

  if (error) {
    return (
      <div className="error-screen">
        <div className="error-card">
          <h2>Connection Error</h2>
          <p>Could not connect to backend. Make sure the FastAPI server is running.</p>
          <p className="error-detail">{error}</p>
        </div>
      </div>
    );
  }

  if (loading || !sessionId) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span className="loading-text">Initializing Mixer Session...</span>
      </div>
    );
  }

  return (
    <div className="workspace">
      {/* Header */}
      <header className="workspace-header">
        <div>
          <h1 className="workspace-title">Mixer Workspace</h1>
          <p className="workspace-subtitle">4-Input / 2-Output FT Component Mixer (Part A)</p>
        </div>
        <ResizePolicyPanel sessionId={sessionId} onPolicyChanged={handlePolicyChanged} />
      </header>

      <main className="workspace-main">
        {/* Input Viewports */}
        <section>
          <div className="section-header">
            <h2 className="section-title">Input Images</h2>
            <div className="section-divider" />
          </div>
          <div key={`inputs-${refreshKey}`} className="input-grid">
            {[0, 1, 2, 3].map((slot) => (
              <ViewportPair
                key={slot}
                sessionId={sessionId}
                slot={slot}
                isInput={true}
                onImageLoaded={handleImageLoaded}
                regionOverlay={regionOverlay}
              />
            ))}
          </div>
        </section>

        {/* Components Mixer */}
        <ComponentsMixer
          onMix={handleMix}
          onCancel={handleCancelMix}
          onRegionChange={handleRegionChange}
          progress={mixProgress}
          loadedSlots={loadedSlots}
        />

        {/* Output Controls */}
        <section className="output-controls">
          <div className="output-controls-label">Target Output Port</div>
          <OutputTargetSelector value={activeOutputTarget} onChange={setActiveOutputTarget} />
        </section>

        {/* Outputs */}
        <section>
          <div className="section-header">
            <h2 className="section-title">Output Ports</h2>
            <div className="section-divider" />
          </div>
          <div key={`outputs-${refreshKey}`} className="output-grid">
            {[4, 5].map((slot) => (
              <ViewportPair
                key={slot}
                sessionId={sessionId}
                slot={slot}
                isInput={false}
                highlighted={activeOutputTarget === (slot - 4)}
                externalSpatialSrc={outputImages[slot - 4]}
              />
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="workspace-footer">
        <div className="footer-left">
          <span>&copy; 2026 FT Mixer v0.2.0</span>
          <span>Status: <span className="status-connected">Connected</span></span>
        </div>
        <div>Session ID: <code className="session-id">{sessionId}</code></div>
      </footer>
    </div>
  );
}
