import type { SurveyDefinition } from '@kajay/core';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { DemoRuntime } from '../api/DemoRuntime.js';
import { CreatorPanel } from './CreatorPanel.js';
import { RendererPanel } from './RendererPanel.js';

type DemoView = 'renderer' | 'creator';

export function DemoWorkspace({ runtime }: { readonly runtime: DemoRuntime }): ReactElement {
  const [definition, setDefinition] = useState<SurveyDefinition>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void runtime
      .loadDefinition()
      .then((result) => {
        if (!active) return;
        if (!result.accepted || result.definition === undefined) {
          throw new Error('The selected SDK did not accept the bundled demo definition.');
        }
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

  return <LoadedWorkspace runtime={runtime} definition={definition} onDefinition={setDefinition} />;
}

function LoadedWorkspace({
  runtime,
  definition,
  onDefinition,
}: {
  readonly runtime: DemoRuntime;
  readonly definition: SurveyDefinition;
  readonly onDefinition: (definition: SurveyDefinition) => void;
}): ReactElement {
  const [view, setView] = useState<DemoView>('renderer');
  return (
    <main>
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
