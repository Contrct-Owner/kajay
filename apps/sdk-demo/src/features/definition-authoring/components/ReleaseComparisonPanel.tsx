import type { ReactElement } from 'react';
import type {
  DefinitionReleaseChange,
  DefinitionReleaseComparison,
} from '../api/DefinitionAuthoringTypes.js';
import type { ReleaseComparisonState } from '../hooks/useReleaseComparison.js';

export function ReleaseComparisonPanel({
  state,
}: {
  readonly state: ReleaseComparisonState;
}): ReactElement | null {
  if (state.targetDigest === undefined) return null;
  return (
    <section className="release-comparison" aria-labelledby="release-comparison-heading">
      <header><div><p className="eyebrow">Pre-activation review</p>
        <h5 id="release-comparison-heading">Release change review</h5></div>
        <button type="button" onClick={state.clear}>Close review</button></header>
      {state.isLoading ? <p role="status">Comparing release artifacts…</p> : null}
      {state.error === undefined ? null
        : <p className="provenance-error" role="alert">{state.error}</p>}
      {state.result === undefined ? null : <ComparisonResult result={state.result} />}
    </section>
  );
}

function ComparisonResult({ result }: { readonly result: DefinitionReleaseComparison }): ReactElement {
  return (
    <div>
      <p className="comparison-route"
        aria-label={`Comparing ${result.baseline?.versionLabel ?? 'no active release'} to ${result.target.versionLabel} in ${result.environmentName}`}>
        <strong>{result.baseline?.versionLabel ?? 'No active release'}</strong>
        <span aria-hidden="true">→</span><strong>{result.target.versionLabel}</strong>
        <span>in {result.environmentName}</span></p>
      {result.initialRelease ? (
        <p className="hint">This is the first activation; there is no active artifact to compare.</p>
      ) : <ChangeSummary result={result} />}
      {result.changes.length === 0 || result.initialRelease ? null : (
        <ol className="release-change-list">{result.changes.map((change) => (
          <ChangeItem key={`${change.kind}:${change.path}`} change={change} />
        ))}</ol>
      )}
      {result.truncated ? (
        <p className="hint" role="status">Only the first 200 semantic changes are shown.</p>
      ) : null}
    </div>
  );
}

function ChangeSummary({ result }: { readonly result: DefinitionReleaseComparison }): ReactElement {
  const summary = result.summary;
  if (summary.total === 0) return <p className="hint">No semantic artifact changes.</p>;
  return (
    <dl className="change-summary">
      <div><dt>Added</dt><dd>{summary.added}</dd></div>
      <div><dt>Removed</dt><dd>{summary.removed}</dd></div>
      <div><dt>Changed</dt><dd>{summary.changed}</dd></div>
      <div><dt>Total</dt><dd>{summary.total}</dd></div>
    </dl>
  );
}

function ChangeItem({ change }: { readonly change: DefinitionReleaseChange }): ReactElement {
  return (
    <li>
      <div><span className={`change-kind change-${change.kind}`}>{change.kind}</span>
        <span>{change.area}</span></div>
      <code>{change.path}</code>
      {change.beforeValue === undefined ? null : (
        <span><small>Before</small><code>{change.beforeValue}</code></span>
      )}
      {change.afterValue === undefined ? null : (
        <span><small>After</small><code>{change.afterValue}</code></span>
      )}
    </li>
  );
}
