import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { createDemoRuntime, DemoWorkspace } from '../features/demo/index.js';

export function App(): ReactElement {
  const runtime = useMemo(
    () => createDemoRuntime(import.meta.env['VITE_KAJAY_RUNTIME']),
    [],
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Kajay SDK</p>
          <h1>One product, two runtimes</h1>
          <p>
            The same renderer and Creator frontend is backed by the{' '}
            <strong>{runtime.name}</strong> SDK profile.
          </p>
        </div>
        <span className="runtime-badge">{runtime.name}</span>
      </header>
      <DemoWorkspace runtime={runtime} />
    </div>
  );
}
