import type { OutputTarget } from '../types/image';

interface OutputTargetSelectorProps {
  value: OutputTarget;
  onChange: (target: OutputTarget) => void;
}

export function OutputTargetSelector({ value, onChange }: OutputTargetSelectorProps) {
  return (
    <div className="output-target-selector">
      <button
        onClick={() => onChange(0)}
        className={`output-target-btn ${value === 0 ? 'active' : ''}`}
      >
        Output 1
      </button>
      <button
        onClick={() => onChange(1)}
        className={`output-target-btn ${value === 1 ? 'active' : ''}`}
      >
        Output 2
      </button>
    </div>
  );
}
