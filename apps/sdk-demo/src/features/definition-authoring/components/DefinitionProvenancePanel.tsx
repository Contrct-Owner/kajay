import type { ReactElement } from 'react';
import type { DefinitionProvenanceState } from '../hooks/useDefinitionProvenance.js';
import { ActivationSummary } from './ActivationSummary.js';
import { AuditHistory } from './AuditHistory.js';
import { EnvironmentPicker } from './EnvironmentPicker.js';
import { EnvironmentOperations } from './EnvironmentOperations.js';
import { ReleaseHistory } from './ReleaseHistory.js';
import { RevisionHistory } from './RevisionHistory.js';

export function DefinitionProvenancePanel({
  state,
}: {
  readonly state: DefinitionProvenanceState;
}): ReactElement {
  const provenance = state.provenance;

  return (
    <section className="provenance-panel" aria-labelledby="provenance-heading">
      <header className="provenance-heading">
        <div>
          <p className="eyebrow">Release operations</p>
          <h3 id="provenance-heading">History &amp; provenance</h3>
          <p className="hint">Trace authored revisions into immutable releases, inspect target readiness, and safely reactivate a prior release.</p>
        </div>
        <EnvironmentPicker environmentName={state.environmentName}
          environments={provenance?.environments ?? []} onSelect={state.selectEnvironment}
          onRefresh={state.refresh} />
      </header>
      <EnvironmentOperations state={state} />
      {state.needsLogin ? (
        <p className="authoring-login" role="alert">Authenticate with WorkOS to view release operations.{' '}
          <a href="/auth/login?loginHint=admin%40kajay.local">Sign in as the local admin</a>
        </p>
      ) : null}
      {state.error === undefined || state.needsLogin ? null : <p className="provenance-error" role="alert">{state.error}</p>}
      {state.isLoading ? <p className="load-state" role="status">Loading release history…</p> : null}
      {!state.isLoading && provenance === undefined ? (
        <p className="hint">Save the managed draft to begin its history.</p>
      ) : null}
      {provenance === undefined ? null : (
        <div className="provenance-grid">
          <ActivationSummary activation={provenance.activation} environmentName={provenance.environmentName} />
          <ReleaseHistory releases={provenance.releases} environmentName={provenance.environmentName}
            isWorking={state.isWorking} preflight={state.preflight}
            onActivate={state.activate} onPreflight={state.runPreflight} />
          <RevisionHistory revisions={provenance.revisions} />
          <AuditHistory events={provenance.auditEvents} />
        </div>
      )}
    </section>
  );
}
