import type { ReactElement } from 'react';
import { useWorkflowDemo } from '../hooks/useWorkflowDemo.js';
import { WorkflowSurvey } from './WorkflowSurvey.js';

export function WorkflowDemoPanel(): ReactElement {
  const state = useWorkflowDemo();
  return (
    <section className="demo-panel workflow-demo" aria-labelledby="workflow-demo-heading">
      <header className="panel-heading">
        <div>
          <p className="eyebrow">Seeded Compose workflow</p>
          <h2 id="workflow-demo-heading">Human review loop</h2>
          <p className="hint">Submit, review, request changes, resubmit, and approve one instance.</p>
        </div>
        {state.instance === undefined ? null : (
          <button type="button" disabled={state.isWorking} onClick={() => { void state.refresh(); }}>
            Refresh status
          </button>
        )}
      </header>
      {state.error === undefined ? null : <p role="alert">{state.error}</p>}
      <WorkflowDemoBody state={state} />
    </section>
  );
}

function WorkflowDemoBody({ state }: { readonly state: ReturnType<typeof useWorkflowDemo> }): ReactElement {
  if (state.definition === undefined || state.isWorking) {
    return <p role="status">Loading workflow demo…</p>;
  }
  if (state.instance === undefined) {
    return <button type="button" onClick={() => { void state.start(); }}>Start review demo</button>;
  }
  if (state.instance.status === 'active' && state.instance.activeStepKey === 'survey') {
    return (
      <WorkflowSurvey
        definition={state.definition}
        round={state.instance.version}
        onSubmit={(snapshot) => { void state.submit(snapshot); }}
      />
    );
  }
  if (state.instance.status === 'waiting-review') {
    return (
      <div>
        <p role="status">Waiting for human review. Open Reviews to decide this submission.</p>
        <code>{state.instance.id}</code>
      </div>
    );
  }
  return (
    <div>
      <p role="status">Workflow {state.instance.status}.</p>
      <button type="button" onClick={state.reset}>Start another instance</button>
    </div>
  );
}
