import type { SurveyDefinition } from '@kajay/core';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { DemoRuntime } from '../api/DemoRuntime.js';
import type { DemoDefinitionResult } from '../api/DemoRuntimeTypes.js';
import { CreatorPanel } from './CreatorPanel.js';
import { RendererPanel } from './RendererPanel.js';
import { RuntimeResult } from './RuntimeResult.js';

type DemoView = 'renderer' | 'creator';

export function DemoWorkspace({ runtime }: { readonly runtime: DemoRuntime }): ReactElement {
  const [definition, setDefinition] = useState<SurveyDefinition>();
  const [loadResult, setLoadResult] = useState<DemoDefinitionResult>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void runtime
      .loadDefinition()
      .then((result) => {
        if (!active) return;
        if (result.definition === undefined) {
          throw new Error('The selected runtime did not return a usable demo definition.');
        }
        setLoadResult(result);
        setDefinition(result.definition);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Demo loading failed.');
      });
    return () => {
      active = false;
    };
  }, [runtime]);

  if (error !== undefined) {
    return <p className="load-state is-error" role="alert">{error}</p>;
  }
  if (definition === undefined) {
    return <p className="load-state" role="status">Loading the {runtime.name} SDK demo…</p>;
  }

  return (
    <LoadedWorkspace
      runtime={runtime}
      definition={definition}
      loadResult={loadResult}
      onDefinition={setDefinition}
    />
  );
}

function LoadedWorkspace({
  runtime,
  definition,
  loadResult,
  onDefinition,
}: {
  readonly runtime: DemoRuntime;
  readonly definition: SurveyDefinition;
  readonly loadResult: DemoDefinitionResult | undefined;
  readonly onDefinition: (definition: SurveyDefinition) => void;
}): ReactElement {
  const [view, setView] = useState<DemoView>('renderer');
  return (
    <main>
      <RuntimeResult result={loadResult} compact />
      <nav className="demo-tabs" aria-label="Demo surface">
        <button
          type="button"
          aria-pressed={view === 'renderer'}
          onClick={() => {
            setView('renderer');
          }}
        >
          Renderer
        </button>
        <button
          type="button"
          aria-pressed={view === 'creator'}
          onClick={() => {
            setView('creator');
          }}
        >
          Creator
        </button>
      </nav>
      {view === 'renderer' ? (
        <RendererPanel definition={definition} runtime={runtime} />
      ) : (
        <CreatorPanel definition={definition} runtime={runtime} onDefinition={onDefinition} />
      )}
    </main>
  );
}
