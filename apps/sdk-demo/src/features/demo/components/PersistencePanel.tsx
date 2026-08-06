import type { SurveyDefinition } from '@kajay/core';
import { useState } from 'react';
import type { ReactElement } from 'react';
import type { DemoRuntime } from '../api/DemoRuntime.js';
import type { DemoSnapshotResult } from '../api/DemoRuntimeTypes.js';

const demoData = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  satisfaction: 5,
};

export function PersistencePanel({
  definition,
  runtime,
}: {
  readonly definition: SurveyDefinition;
  readonly runtime: DemoRuntime;
}): ReactElement {
  const [result, setResult] = useState<DemoSnapshotResult>();
  const [error, setError] = useState<string>();

  const run = (): void => {
    setError(undefined);
    void runtime.roundTripSnapshot(definition, demoData)
      .then(setResult)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Snapshot round trip failed.');
      });
  };

  return (
    <section className="demo-panel">
      <div className="panel-heading">
        <h2>Portable persistence</h2>
        <button type="button" onClick={run}>Save and restore</button>
      </div>
      <p className="hint">
        Capture Response Snapshot Format v1, serialize it as database JSON, then restore
        a fresh survey instance. Compare mode requires byte-shaped agreement from both SDKs.
      </p>
      {error === undefined ? null : <p className="load-state is-error">{error}</p>}
      {result === undefined ? null : (
        <aside className={`runtime-result ${result.comparison?.matched === false ? 'is-error' : 'is-success'}`}>
          <strong>{result.comparison?.matched === false ? 'SDK snapshots differed' : 'Snapshot restored successfully'}</strong>
          <p>Definition identity: <code>{result.definitionDigest}</code></p>
          {result.comparison === undefined ? null : (
            <p className="comparison-status">
              {result.comparison.matched
                ? 'C# and TypeScript emitted the same portable snapshot.'
                : `Runtime differences: ${result.comparison.differences.join(', ')}.`}
            </p>
          )}
          <details>
            <summary>Stored snapshot JSON</summary>
            <pre>{JSON.stringify(result.snapshot, null, 2)}</pre>
          </details>
        </aside>
      )}
    </section>
  );
}
