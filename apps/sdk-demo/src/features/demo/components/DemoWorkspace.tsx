import type { SurveyDefinition } from '@kajay/core';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { DemoRuntime } from '../api/DemoRuntime.js';
import type { DemoDefinitionResult } from '../api/DemoRuntimeTypes.js';
import { CreatorPanel } from './CreatorPanel.js';
import { RendererPanel } from './RendererPanel.js';
import { RuntimeResult } from './RuntimeResult.js';
import { PersistencePanel } from './PersistencePanel.js';

type DemoView = 'renderer' | 'creator' | 'persistence';

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
      <ViewTabs selected={view} onSelected={setView} />
      {view === 'renderer' ? (
        <RendererPanel definition={definition} runtime={runtime} />
      ) : view === 'creator' ? (
        <CreatorPanel definition={definition} runtime={runtime} onDefinition={onDefinition} />
      ) : (
        <PersistencePanel definition={definition} runtime={runtime} />
      )}
    </main>
  );
}

function ViewTabs({
  selected,
  onSelected,
}: {
  readonly selected: DemoView;
  readonly onSelected: (view: DemoView) => void;
}): ReactElement {
  const views: readonly DemoView[] = ['renderer', 'creator', 'persistence'];
  return (
    <nav className="demo-tabs" aria-label="Demo surface">
      {views.map((view) => (
        <button
          type="button"
          key={view}
          aria-pressed={selected === view}
          onClick={() => {
            onSelected(view);
          }}
        >
          {view[0]?.toUpperCase()}{view.slice(1)}
        </button>
      ))}
    </nav>
  );
}
