import { SurveyCreator } from '@kajay/creator-react';
import type { SurveyDefinition } from '@kajay/core';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { useDefinitionAuthoring } from '../hooks/useDefinitionAuthoring.js';
import { useDefinitionProvenance } from '../hooks/useDefinitionProvenance.js';
import { DefinitionProvenancePanel } from './DefinitionProvenancePanel.js';
import { shortDigest } from './provenanceFormatting.js';

const managedName = 'onboarding';

export function DefinitionAuthoringPanel({
  initialDefinition,
}: {
  readonly initialDefinition: SurveyDefinition;
}): ReactElement {
  const authoring = useDefinitionAuthoring(managedName, initialDefinition);
  const provenance = useDefinitionProvenance(
    managedName,
    `${authoring.draft?.version ?? 0}:${authoring.revision?.number ?? 0}:${authoring.release?.digest ?? ''}`,
  );
  const [versionLabel, setVersionLabel] = useState('1.0.0');

  if (authoring.isLoading) {
    return <p className="load-state" role="status">Loading the managed draft…</p>;
  }

  return (
    <section className="demo-panel creator-panel" aria-labelledby="managed-heading">
      <header className="managed-heading">
        <div>
          <p className="eyebrow">Workflow host</p>
          <h2 id="managed-heading">Managed definition</h2>
          <p className="hint">
            Save an ETag-protected draft, checkpoint an immutable revision, then assemble
            the exact <code>.kajay</code> release the host can promote.
          </p>
        </div>
        <code>{managedName}</code>
      </header>
      {authoring.needsLogin ? (
        <p className="authoring-login" role="alert">
          Authenticate with WorkOS to manage definitions.{' '}
          <a href="/auth/login?loginHint=admin%40kajay.local">Sign in as the local admin</a>
        </p>
      ) : null}
      <AuthoringStatus authoring={authoring} />
      <AuthoringEditor
        authoring={authoring}
        versionLabel={versionLabel}
        onVersionLabel={setVersionLabel}
      />
      {authoring.needsLogin ? null : <DefinitionProvenancePanel state={provenance} />}
    </section>
  );
}

function AuthoringEditor({
  authoring,
  versionLabel,
  onVersionLabel,
}: {
  readonly authoring: ReturnType<typeof useDefinitionAuthoring>;
  readonly versionLabel: string;
  readonly onVersionLabel: (value: string) => void;
}): ReactElement {
  return (
    <>
      <SurveyCreator
        value={authoring.definition}
        onChange={authoring.setDefinition}
        tabs={['design', 'preview', 'json']}
        save={authoring.save}
        isAutoSave
      />
      <div className="release-actions" aria-label="Revision and release actions">
        <button
          type="button"
          disabled={authoring.draft === undefined || authoring.isWorking}
          onClick={() => { void authoring.checkpoint(); }}
        >
          Create revision
        </button>
        <label>
          Version label
          <input
            value={versionLabel}
            maxLength={128}
            onChange={(event) => { onVersionLabel(event.target.value); }}
          />
        </label>
        <button
          type="button"
          disabled={authoring.revision === undefined || authoring.isWorking}
          onClick={() => { void authoring.createRelease(versionLabel); }}
        >
          Create release
        </button>
      </div>
    </>
  );
}

function AuthoringStatus({
  authoring,
}: {
  readonly authoring: ReturnType<typeof useDefinitionAuthoring>;
}): ReactElement {
  return (
    <aside className="authoring-status" aria-live="polite">
      <span>Draft <strong>{authoring.draft?.version ?? 'unsaved'}</strong></span>
      <span>Revision <strong>{authoring.revision?.number ?? 'none'}</strong></span>
      <span>Release <strong>{shortDigest(authoring.release?.digest)}</strong></span>
      {authoring.isWorking ? <span role="status">Working…</span> : null}
      {authoring.error === undefined || authoring.needsLogin
        ? null
        : <span role="alert">{authoring.error}</span>}
    </aside>
  );
}
