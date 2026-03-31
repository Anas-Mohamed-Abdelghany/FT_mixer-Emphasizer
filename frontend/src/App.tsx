import { useState } from 'react';
import { SessionProvider } from './context/SessionContext';
import { MixerWorkspace } from './components/MixerWorkspace';
import { EmphasizerWorkspace } from './components/EmphasizerWorkspace';
import { ModeSwitcher } from './components/ModeSwitcher';
import type { AppMode } from './types/image';
import './App.css';

function App() {
  const [mode, setMode] = useState<AppMode>('mixer');

  return (
    <SessionProvider>
      <ModeSwitcher mode={mode} onChange={setMode} />
      {mode === 'mixer' ? <MixerWorkspace /> : <EmphasizerWorkspace />}
    </SessionProvider>
  );
}

export default App;
