import { useState } from 'react';
import { SessionProvider } from './context/SessionContext';
import { MixerWorkspace } from './components/MixerWorkspace';
import { EmphasizerWorkspace } from './components/EmphasizerWorkspace';
import type { AppMode } from './types/image';
import './App.css';

function App() {
  const [mode, setMode] = useState<AppMode>('mixer');

  return (
    <SessionProvider>
      {/* Mode Switcher */}
      <nav className="mode-switcher">
        <button
          className={`mode-btn ${mode === 'mixer' ? 'active' : ''}`}
          onClick={() => setMode('mixer')}
        >
          <svg className="mode-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Part A — Mixer
        </button>
        <button
          className={`mode-btn ${mode === 'emphasizer' ? 'active' : ''}`}
          onClick={() => setMode('emphasizer')}
        >
          <svg className="mode-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Part B — Emphasizer
        </button>
      </nav>

      {mode === 'mixer' ? <MixerWorkspace /> : <EmphasizerWorkspace />}
    </SessionProvider>
  );
}

export default App;
