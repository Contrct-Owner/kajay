import type { SurveyDefinition } from '@kajay/core';
import { lazy, Suspense, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { DemoRuntime } from '../api/DemoRuntime.js';
import type { DemoDefinitionResult } from '../api/DemoRuntimeTypes.js';
import { CreatorPanel } from './CreatorPanel.js';
import { RendererPanel } from './RendererPanel.js';
import { RuntimeResult } from './RuntimeResult.js';
import { PersistencePanel } from './PersistencePanel.js';

const DefinitionAuthoringPanel = lazy(async () => ({
  default: (await import('../../definition-authoring/index.js')).DefinitionAuthoringPanel,
}));
const ReviewWorkbenchPanel = lazy(async () => ({
  default: (await import('../../review-workbench/index.js')).ReviewWorkbenchPanel,
}));
const WorkflowDemoPanel = lazy(async () => ({
  default: (await import('../../workflow-demo/index.js')).WorkflowDemoPanel,
}));

type DemoView = 'renderer' | 'creator' | 'persistence' | 'managed' | 'workflow' | 'reviews';

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
      <Suspense fallback={<p role="status">Loading demo surface…</p>}>
        {view === 'renderer' ? (
          <RendererPanel definition={definition} runtime={runtime} />
        ) : view === 'creator' ? (
          <CreatorPanel definition={definition} runtime={runtime} onDefinition={onDefinition} />
        ) : view === 'persistence' ? (
          <PersistencePanel definition={definition} runtime={runtime} />
        ) : view === 'managed' ? (
          <DefinitionAuthoringPanel initialDefinition={definition} />
        ) : view === 'workflow' ? (
          <WorkflowDemoPanel />
        ) : (
          <ReviewWorkbenchPanel />
        )}
      </Suspense>
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
  const views: readonly DemoView[] = [
    'renderer', 'creator', 'persistence', 'managed', 'workflow', 'reviews',
  ];
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
