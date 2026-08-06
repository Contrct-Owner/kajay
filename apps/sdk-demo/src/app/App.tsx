import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { createDemoRuntimes, DemoWorkspace } from '../features/demo/index.js';
import type { DemoRuntimeName } from '../features/demo/api/DemoRuntimeTypes.js';

const runtimeLabels: Readonly<Record<DemoRuntimeName, string>> = {
  compare: 'Compare',
  dotnet: '.NET',
  typescript: 'TypeScript',
};

export function App(): ReactElement {
  const catalog = useMemo(
    () => createDemoRuntimes(import.meta.env['VITE_KAJAY_RUNTIME']),
    [],
  );
  const [runtime, setRuntime] = useState(catalog.initial);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Kajay SDK</p>
          <h1>One product, two runtimes</h1>
          <p>
            Direct every authoritative request to one SDK, or ask both and compare their
            stable results.
          </p>
        </div>
        <RuntimeSelector
          runtimes={catalog.available}
          selected={runtime}
          onSelected={setRuntime}
        />
      </header>
      <DemoWorkspace key={runtime.name} runtime={runtime} />
    </div>
  );
}

function RuntimeSelector({
  runtimes,
  selected,
  onSelected,
}: {
  readonly runtimes: ReturnType<typeof createDemoRuntimes>['available'];
  readonly selected: ReturnType<typeof createDemoRuntimes>['initial'];
  readonly onSelected: (runtime: ReturnType<typeof createDemoRuntimes>['initial']) => void;
}): ReactElement {
  return (
    <nav className="runtime-selector" aria-label="Runtime authority">
      {runtimes.map((runtime) => (
        <button
          type="button"
          key={runtime.name}
          aria-pressed={runtime === selected}
          onClick={() => { onSelected(runtime); }}
        >
          {runtimeLabels[runtime.name]}
        </button>
      ))}
    </nav>
  );
}
