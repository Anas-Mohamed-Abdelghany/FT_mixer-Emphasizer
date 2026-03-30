import { useState, useCallback, useEffect } from 'react';
import { setResizePolicy, getResizePolicy } from '../services/imageApi';
import type { ResizePolicyState } from '../types/image';

interface ResizePolicyPanelProps {
  sessionId: string;
  onPolicyChanged: () => void;
}

export function ResizePolicyPanel({ sessionId, onPolicyChanged }: ResizePolicyPanelProps) {
  const [state, setState] = useState<ResizePolicyState>({
    mode: 'smallest',
    fixedWidth: 256,
    fixedHeight: 256,
    preserveAspect: true,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getResizePolicy(sessionId).then(res => {
      setState({
        mode: res.mode as ResizePolicyState['mode'],
        fixedWidth: res.fixed_width || 256,
        fixedHeight: res.fixed_height || 256,
        preserveAspect: res.preserve_aspect,
      });
    }).catch(console.error);
  }, [sessionId]);

  const applyPolicy = useCallback(async (newState: ResizePolicyState) => {
    setLoading(true);
    try {
      await setResizePolicy(sessionId, {
        mode: newState.mode,
        fixed_width: newState.mode === 'fixed' ? newState.fixedWidth : undefined,
        fixed_height: newState.mode === 'fixed' ? newState.fixedHeight : undefined,
        preserve_aspect: newState.preserveAspect,
      });
      onPolicyChanged();
    } catch (err) {
      console.error('Failed to set resize policy:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId, onPolicyChanged]);

  const handleChange = (updates: Partial<ResizePolicyState>) => {
    const newState = { ...state, ...updates };
    setState(newState);
    applyPolicy(newState);
  };

  return (
    <div className="resize-panel">
      <div className="resize-field">
        <label className="resize-label">Resize Mode</label>
        <select
          value={state.mode}
          onChange={e => handleChange({ mode: e.target.value as ResizePolicyState['mode'] })}
          className="resize-select"
          disabled={loading}
        >
          <option value="smallest">To Smallest</option>
          <option value="largest">To Largest</option>
          <option value="fixed">Fixed Size</option>
        </select>
      </div>

      {state.mode === 'fixed' && (
        <>
          <div className="resize-field resize-field-small">
            <label className="resize-label">Width</label>
            <input
              type="number"
              value={state.fixedWidth}
              onChange={e => setState({ ...state, fixedWidth: parseInt(e.target.value) || 0 })}
              onBlur={() => applyPolicy(state)}
              className="resize-input"
            />
          </div>
          <div className="resize-field resize-field-small">
            <label className="resize-label">Height</label>
            <input
              type="number"
              value={state.fixedHeight}
              onChange={e => setState({ ...state, fixedHeight: parseInt(e.target.value) || 0 })}
              onBlur={() => applyPolicy(state)}
              className="resize-input"
            />
          </div>
        </>
      )}

      <label className="resize-checkbox-label">
        <input
          type="checkbox"
          checked={state.preserveAspect}
          onChange={e => handleChange({ preserveAspect: e.target.checked })}
          className="resize-checkbox"
        />
        Preserve Aspect Ratio
      </label>

      {loading && <div className="spinner spinner-sm" />}
    </div>
  );
}
