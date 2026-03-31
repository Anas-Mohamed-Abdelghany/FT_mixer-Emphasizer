/**
 * EmphasizerWorkspace.tsx — Part B: FT Properties Emphasizer.
 *
 * Layout:
 *  - Action selection panel (combo box + parameters)
 *  - Domain toggle (Spatial / Frequency)
 *  - 4 viewports: Original Spatial, Modified Spatial, Original FT, Modified FT
 *  - Each viewport supports magnitude/phase/real/imaginary viewing
 *  - Multiple FT count on top of any action
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { EmphasizerAction, EmphasizerParams, FTComponent, WindowType } from '../types/image';
import { useSession } from '../hooks/useSession';
import * as imageApi from '../services/imageApi';
import * as emphasizerApi from '../services/emphasizerApi';
import { ProgressBar } from './ProgressBar';
import {
  type ComplexImage,
  loadFileAsComplexImage,
  shiftImage,
  multiplyByExp,
  stretchImage,
  mirrorImage,
  makeEvenOdd,
  rotateImage,
  differentiateImage,
  integrateImage,
  applyWindow,
  applyMultipleFT,
  computeFT,
  computeIFT,
  complexImageToPngBase64,
  complexImageToFTPngBase64,
} from '../services/emphasisEngine';
import { useMouseDrag } from '../hooks/useMouseDrag';

// ── Viewport subcomponent for emphasis ──────────────────────────────

function EmphasisViewport({ label, imageSrc, allowUpload, onLoad }: {
  label: string;
  imageSrc: string | null;
  allowUpload?: boolean;
  onLoad?: () => void;
}) {
  const [component, setComponent] = useState<FTComponent | 'magnitude'>('magnitude');
  const { brightness, contrast, isDragging, handlers } = useMouseDrag();
  const _comp = component; void _comp; // used for dropdown

  return (
    <div className="viewport-component">
      <div className="viewport-header">
        <span className="viewport-label">{label}</span>
        <select
          value={component}
          onChange={e => setComponent(e.target.value as FTComponent)}
          className="viewport-dropdown"
          disabled={!imageSrc}
        >
          <option value="magnitude">Magnitude</option>
          <option value="phase">Phase</option>
          <option value="real">Real</option>
          <option value="imaginary">Imaginary</option>
        </select>
      </div>
      <div
        className={`viewport-canvas ${isDragging ? 'dragging' : ''} ${allowUpload ? 'clickable' : ''}`}
        onDoubleClick={allowUpload ? onLoad : undefined}
        onMouseDown={handlers.onMouseDown}
        onMouseMove={handlers.onMouseMove}
        onMouseUp={handlers.onMouseUp}
        onMouseLeave={handlers.onMouseLeave}
        style={{
          filter: `brightness(${1 + brightness}) contrast(${contrast})`,
        }}
      >
        {imageSrc ? (
          <img src={imageSrc} alt={label} className="viewport-image" draggable={false} />
        ) : (
          <div className="viewport-empty">
            <svg className="viewport-empty-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="viewport-empty-text">{allowUpload ? 'Double-click to load' : 'Result'}</span>
          </div>
        )}
      </div>
      <div className="viewport-footer">
        <span className="viewport-filename">{imageSrc ? label : 'No image'}</span>
        <span>B:{brightness.toFixed(2)} C:{contrast.toFixed(2)}</span>
      </div>
    </div>
  );
}

// ── Main Emphasizer Workspace ───────────────────────────────────────

const DEFAULT_PARAMS: EmphasizerParams = {
  shiftX: 10, shiftY: 10,
  expU: 5, expV: 5,
  stretchFactor: 1.5,
  mirrorAxis: 'horizontal',
  evenOddType: 'even',
  rotateAngle: 45,
  diffDirection: 'both',
  intDirection: 'x',
  windowType: 'gaussian',
  windowWidthRatio: 0.5,
  windowHeightRatio: 0.5,
  windowSigma: 0.5,
  ftCount: 1,
  applyInFrequency: false,
};

const ACTION_LABELS: Record<EmphasizerAction, string> = {
  'shift': 'Shift Image',
  'complex-exponential': 'Complex Exponential',
  'stretch': 'Stretch / Scale',
  'mirror': 'Mirror (Symmetry)',
  'even-odd': 'Make Even / Odd',
  'rotate': 'Rotate',
  'differentiate': 'Differentiate',
  'integrate': 'Integrate',
  'window': '2D Window',
  'multiple-ft': 'Multiple FT',
};

export function EmphasizerWorkspace() {
  const { sessionId } = useSession();
  const [useBackend, setUseBackend] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0);
  const [showProgress, setShowProgress] = useState<boolean>(false);
  const backendCancelRef = useRef<(() => void) | null>(null);

  const [action, setAction] = useState<EmphasizerAction>('shift');
  const [params, setParams] = useState<EmphasizerParams>(DEFAULT_PARAMS);
  const [originalImage, setOriginalImage] = useState<ComplexImage | null>(null);
  const [originalPixels, setOriginalPixels] = useState<number[] | null>(null);
  const [processing, setProcessing] = useState(false);

  // Display images (data URLs)
  const [origSpatial, setOrigSpatial] = useState<string | null>(null);
  const [modSpatial, setModSpatial] = useState<string | null>(null);
  const [origFT, setOrigFT] = useState<string | null>(null);
  const [modFT, setModFT] = useState<string | null>(null);

  // Viewport component selection
  const [spatialComp, setSpatialComp] = useState<FTComponent>('magnitude');
  const [ftComp, setFtComp] = useState<FTComponent>('magnitude');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateParam = useCallback(<K extends keyof EmphasizerParams>(key: K, value: EmphasizerParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  // Load original image
  const handleLoadImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (sessionId) {
        await imageApi.uploadImage(sessionId, 0, file);
      }
      const { img, pixels } = await loadFileAsComplexImage(file);
      setOriginalImage(img);
      setOriginalPixels(pixels);
    } catch (err) {
      console.error('Failed to load image:', err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [sessionId]);

  const handleApplyBackend = useCallback(async () => {
    if (!sessionId || !originalImage) return;

    if (backendCancelRef.current) {
      backendCancelRef.current();
      backendCancelRef.current = null;
    }

    try {
      setShowProgress(true);
      setProgress(0);

      const request: emphasizerApi.TransformRequest = {
        operation: action,
        params: params as any,
        domain: params.applyInFrequency ? 'frequency' : 'spatial',
        slot: 0,
      };

      const { request_id } = await emphasizerApi.applyTransform(sessionId, request);

      const cancelProgress = emphasizerApi.connectProgress(
        sessionId,
        (event) => {
          if (event.request_id === request_id) {
            setProgress(event.progress);
          }
        },
        async () => {
          try {
            const result = await emphasizerApi.getTransformResult(sessionId, request_id);
            setModSpatial(`data:image/png;base64,${result.preview}`);
            setModFT(`data:image/png;base64,${result.ft_preview}`);
          } catch (err) {
            console.error('Failed to get backend result:', err);
          } finally {
            setTimeout(() => {
              setShowProgress(false);
            }, 500);
          }
        },
        (err) => {
          console.error('Progress stream error:', err);
          setShowProgress(false);
        }
      );

      backendCancelRef.current = cancelProgress;
    } catch (err) {
      console.error('Backend execution failed:', err);
      setShowProgress(false);
    }
  }, [sessionId, originalImage, action, params]);

  // Apply action whenever image, action, or params change
  useEffect(() => {
    if (!originalImage || !originalPixels) return;
    setProcessing(true);

    // Use setTimeout to not block the UI
    const timeoutId = setTimeout(() => {
      try {
        // Render original spatial
        setOrigSpatial(complexImageToPngBase64(originalImage, spatialComp));

        // Render original FT
        const origFFT = computeFT(originalImage);
        setOrigFT(complexImageToFTPngBase64(origFFT, ftComp));

        if (useBackend) {
          setProcessing(false);
          return;
        }

        // Apply action
        let modified: ComplexImage;
        let targetImage = params.applyInFrequency ? origFFT : originalImage;

        switch (action) {
          case 'shift':
            modified = shiftImage(targetImage, params.shiftX, params.shiftY);
            break;
          case 'complex-exponential':
            modified = multiplyByExp(targetImage, params.expU, params.expV);
            break;
          case 'stretch':
            modified = stretchImage(targetImage, params.stretchFactor);
            break;
          case 'mirror':
            modified = mirrorImage(targetImage, params.mirrorAxis);
            break;
          case 'even-odd':
            modified = makeEvenOdd(targetImage, params.evenOddType);
            break;
          case 'rotate':
            modified = rotateImage(targetImage, params.rotateAngle);
            break;
          case 'differentiate':
            modified = differentiateImage(targetImage, params.diffDirection);
            break;
          case 'integrate':
            modified = integrateImage(targetImage, params.intDirection);
            break;
          case 'window':
            modified = applyWindow(targetImage, {
              type: params.windowType,
              widthRatio: params.windowWidthRatio,
              heightRatio: params.windowHeightRatio,
              sigma: params.windowSigma,
            });
            break;
          case 'multiple-ft':
            modified = applyMultipleFT(targetImage, params.ftCount);
            break;
          default:
            modified = targetImage;
        }

        // If applying in frequency domain, show results differently
        if (params.applyInFrequency) {
          // Modified is in frequency domain → show it as FT, and its IFT as spatial
          setModFT(complexImageToFTPngBase64(modified, ftComp));
          const ifftResult = computeIFT(modified);
          setModSpatial(complexImageToPngBase64(ifftResult, spatialComp));
        } else {
          // Modified is in spatial domain → show it, and its FT
          setModSpatial(complexImageToPngBase64(modified, spatialComp));
          const modFFT = computeFT(modified);
          setModFT(complexImageToFTPngBase64(modFFT, ftComp));
        }
      } catch (err) {
        console.error('Emphasis computation error:', err);
      } finally {
        setProcessing(false);
      }
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [originalImage, originalPixels, action, params, spatialComp, ftComp, useBackend]);

  return (
    <div className="workspace">
      <header className="workspace-header">
        <div>
          <h1 className="workspace-title">FT Properties Emphasizer</h1>
          <p className="workspace-subtitle">Explore Fourier Transform properties and duality</p>
        </div>
      </header>

      <main className="workspace-main emphasizer-layout">
        {/* Action Panel */}
        <aside className="action-panel">
          <div className="action-panel-section">
            <label className="action-label">Action</label>
            <select
              value={action}
              onChange={e => setAction(e.target.value as EmphasizerAction)}
              className="action-select"
            >
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Domain Toggle */}
          <div className="action-panel-section">
            <label className="action-label">Apply in Domain</label>
            <div className="domain-toggle">
              <button
                className={`domain-btn ${!params.applyInFrequency ? 'active' : ''}`}
                onClick={() => updateParam('applyInFrequency', false)}
              >
                Spatial
              </button>
              <button
                className={`domain-btn ${params.applyInFrequency ? 'active' : ''}`}
                onClick={() => updateParam('applyInFrequency', true)}
              >
                Frequency
              </button>
            </div>
          </div>

          {/* Component Selection */}
          <div className="action-panel-section">
            <label className="action-label">Spatial View</label>
            <select value={spatialComp} onChange={e => setSpatialComp(e.target.value as FTComponent)} className="action-select">
              <option value="magnitude">Magnitude</option>
              <option value="phase">Phase</option>
              <option value="real">Real</option>
              <option value="imaginary">Imaginary</option>
            </select>
          </div>
          <div className="action-panel-section">
            <label className="action-label">Frequency View</label>
            <select value={ftComp} onChange={e => setFtComp(e.target.value as FTComponent)} className="action-select">
              <option value="magnitude">Magnitude</option>
              <option value="phase">Phase</option>
              <option value="real">Real</option>
              <option value="imaginary">Imaginary</option>
            </select>
          </div>

          <div className="action-panel-divider" />

          {/* Action-Specific Parameters */}
          <div className="action-params">
            {action === 'shift' && (
              <>
                <ParamSlider label="Shift X" value={params.shiftX} min={-100} max={100} step={1} onChange={v => updateParam('shiftX', v)} />
                <ParamSlider label="Shift Y" value={params.shiftY} min={-100} max={100} step={1} onChange={v => updateParam('shiftY', v)} />
              </>
            )}
            {action === 'complex-exponential' && (
              <>
                <ParamSlider label="Frequency U" value={params.expU} min={-50} max={50} step={0.5} onChange={v => updateParam('expU', v)} />
                <ParamSlider label="Frequency V" value={params.expV} min={-50} max={50} step={0.5} onChange={v => updateParam('expV', v)} />
              </>
            )}
            {action === 'stretch' && (
              <ParamSlider label="Factor" value={params.stretchFactor} min={0.1} max={4} step={0.1} onChange={v => updateParam('stretchFactor', v)} />
            )}
            {action === 'mirror' && (
              <div className="action-panel-section">
                <label className="action-label">Axis</label>
                <select value={params.mirrorAxis} onChange={e => updateParam('mirrorAxis', e.target.value as 'horizontal' | 'vertical' | 'both')} className="action-select">
                  <option value="horizontal">Horizontal</option>
                  <option value="vertical">Vertical</option>
                  <option value="both">Both</option>
                </select>
              </div>
            )}
            {action === 'even-odd' && (
              <div className="action-panel-section">
                <label className="action-label">Type</label>
                <div className="domain-toggle">
                  <button className={`domain-btn ${params.evenOddType === 'even' ? 'active' : ''}`} onClick={() => updateParam('evenOddType', 'even')}>Even</button>
                  <button className={`domain-btn ${params.evenOddType === 'odd' ? 'active' : ''}`} onClick={() => updateParam('evenOddType', 'odd')}>Odd</button>
                </div>
              </div>
            )}
            {action === 'rotate' && (
              <ParamSlider label="Angle (°)" value={params.rotateAngle} min={0} max={360} step={1} onChange={v => updateParam('rotateAngle', v)} />
            )}
            {action === 'differentiate' && (
              <div className="action-panel-section">
                <label className="action-label">Direction</label>
                <select value={params.diffDirection} onChange={e => updateParam('diffDirection', e.target.value as 'x' | 'y' | 'both')} className="action-select">
                  <option value="x">Horizontal (X)</option>
                  <option value="y">Vertical (Y)</option>
                  <option value="both">Both (Gradient)</option>
                </select>
              </div>
            )}
            {action === 'integrate' && (
              <div className="action-panel-section">
                <label className="action-label">Direction</label>
                <select value={params.intDirection} onChange={e => updateParam('intDirection', e.target.value as 'x' | 'y' | 'both')} className="action-select">
                  <option value="x">Horizontal (X)</option>
                  <option value="y">Vertical (Y)</option>
                  <option value="both">Both</option>
                </select>
              </div>
            )}
            {action === 'window' && (
              <>
                <div className="action-panel-section">
                  <label className="action-label">Window Type</label>
                  <select value={params.windowType} onChange={e => updateParam('windowType', e.target.value as WindowType)} className="action-select">
                    <option value="rectangular">Rectangular</option>
                    <option value="gaussian">Gaussian</option>
                    <option value="hamming">Hamming</option>
                    <option value="hanning">Hanning</option>
                  </select>
                </div>
                <ParamSlider label="Width Ratio" value={params.windowWidthRatio} min={0.05} max={1} step={0.05} onChange={v => updateParam('windowWidthRatio', v)} />
                <ParamSlider label="Height Ratio" value={params.windowHeightRatio} min={0.05} max={1} step={0.05} onChange={v => updateParam('windowHeightRatio', v)} />
                {params.windowType === 'gaussian' && (
                  <ParamSlider label="Sigma" value={params.windowSigma} min={0.1} max={2} step={0.05} onChange={v => updateParam('windowSigma', v)} />
                )}
              </>
            )}
            {action === 'multiple-ft' && (
              <ParamSlider label="FT Count" value={params.ftCount} min={1} max={10} step={1} onChange={v => updateParam('ftCount', v)} />
            )}
            
            <div className="emphasizer-backend-controls" style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label className="backend-toggle-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input 
                  type="checkbox" 
                  checked={useBackend} 
                  onChange={e => setUseBackend(e.target.checked)}
                  className="backend-toggle-checkbox"
                />
                <span style={{ fontSize: '11px', fontWeight: 'bold' }}>Use Backend (Threaded)</span>
              </label>
              
              {useBackend && (
                <>
                  <button 
                    className="mode-btn active"
                    onClick={handleApplyBackend}
                    disabled={!originalImage || showProgress}
                    style={{ width: '100%', padding: '8px', cursor: (!originalImage || showProgress) ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                  >
                    Apply to Backend
                  </button>
                  <ProgressBar progress={progress} visible={showProgress} />
                </>
              )}
            </div>
          </div>
        </aside>

        {/* Viewports Grid */}
        <div className="emphasizer-viewports">
          {processing && (
            <div className="emphasizer-processing">
              <div className="spinner" />
              <span>Processing...</span>
            </div>
          )}
          <div className="emphasizer-grid">
            <EmphasisViewport
              label={params.applyInFrequency ? "Original Spatial" : "Original Spatial"}
              imageSrc={origSpatial}
              allowUpload={true}
              onLoad={handleLoadImage}
            />
            <EmphasisViewport
              label={params.applyInFrequency ? "Result Spatial (IFFT)" : "Modified Spatial"}
              imageSrc={modSpatial}
            />
            <EmphasisViewport
              label={params.applyInFrequency ? "Original FT" : "Original FT"}
              imageSrc={origFT}
            />
            <EmphasisViewport
              label={params.applyInFrequency ? "Modified FT" : "Result FT"}
              imageSrc={modFT}
            />
          </div>
        </div>
      </main>

      <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.bmp" onChange={handleFileChange} className="hidden" />
    </div>
  );
}

// ── Parameter Slider subcomponent ───────────────────────────────────

function ParamSlider({ label, value, min, max, step, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="param-slider">
      <label className="param-slider-label">{label}</label>
      <div className="param-slider-row">
        <input
          type="range"
          min={min} max={max} step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="mixer-slider"
        />
        <input
          type="number"
          min={min} max={max} step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="param-number-input"
        />
      </div>
    </div>
  );
}
