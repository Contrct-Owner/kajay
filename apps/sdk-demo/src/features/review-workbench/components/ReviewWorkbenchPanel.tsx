import type { ReactElement } from 'react';
import { useReviewWorkbench } from '../hooks/useReviewWorkbench.js';
import { ReviewTaskDetailPanel } from './ReviewTaskDetailPanel.js';
import { ReviewTaskList } from './ReviewTaskList.js';

export function ReviewWorkbenchPanel(): ReactElement {
  const state = useReviewWorkbench();
  return (
    <section className="demo-panel review-workbench" aria-labelledby="review-heading">
      <header className="managed-heading">
        <div>
          <p className="eyebrow">Workflow host</p>
          <h2 id="review-heading">Review tasks</h2>
          <p className="hint">
            Decide only submissions assigned to your authenticated WorkOS permissions.
          </p>
        </div>
        <button type="button" disabled={state.isLoading} onClick={() => { void state.refresh(); }}>
          Refresh
        </button>
      </header>
      {state.needsLogin ? (
        <p role="alert">
          Authenticate with WorkOS to review submissions.{' '}
          <a href="/auth/login?loginHint=reviewer%40kajay.local">Sign in as local reviewer</a>
        </p>
      ) : null}
      {state.error === undefined || state.needsLogin ? null : <p role="alert">{state.error}</p>}
      {state.selected === undefined ? <ReviewQueue state={state} /> : (
        <ReviewTaskDetailPanel
          detail={state.selected}
          isWorking={state.isWorking}
          onClose={state.close}
          onDecide={(input) => { void state.decide(input); }}
        />
      )}
    </section>
  );
}

function ReviewQueue({ state }: { readonly state: ReturnType<typeof useReviewWorkbench> }): ReactElement {
  return (
    <>
      <ReviewFilters state={state} />
      <ReviewTaskList
        items={state.items}
        isLoading={state.isLoading}
        status={state.status}
        onOpen={(taskId) => { void state.open(taskId); }}
      />
      {state.nextCursor === undefined ? null : (
        <button type="button" disabled={state.isLoading} onClick={() => { void state.loadMore(); }}>
          Load more
        </button>
      )}
    </>
  );
}

function ReviewFilters({ state }: { readonly state: ReturnType<typeof useReviewWorkbench> }): ReactElement {
  return (
    <div className="review-filters">
        <label>
          Task status
          <select
            value={state.status}
            onChange={(event) => {
              state.setStatus(event.target.value === 'completed' ? 'completed' : 'pending');
            }}
          >
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        <label>
          Workflow
          <input
            value={state.managedName}
            placeholder="All managed definitions"
            onChange={(event) => { state.setManagedName(event.target.value); }}
          />
        </label>
        <label>
          Task age
          <select
            value={state.age}
            onChange={(event) => {
              const value = event.target.value;
              state.setAge(value === 'day' || value === 'week' || value === 'month' ? value : 'any');
            }}
          >
            <option value="any">Any age</option>
            <option value="day">Last 24 hours</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
          </select>
        </label>
    </div>
  );
}
