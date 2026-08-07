import { useState } from 'react';
import type { ReactElement } from 'react';
import type { DefinitionReleaseHistory } from '../api/DefinitionAuthoringTypes.js';
import { formatTimestamp, shortDigest } from './provenanceFormatting.js';

export function ReleaseHistory({
  releases,
  environmentName,
  isWorking,
  onRollback,
}: {
  readonly releases: readonly DefinitionReleaseHistory[];
  readonly environmentName: string;
  readonly isWorking: boolean;
  readonly onRollback: (releaseDigest: string) => Promise<void>;
}): ReactElement {
  const [pendingDigest, setPendingDigest] = useState<string>();

  return (
    <section className="provenance-card release-history" aria-labelledby="release-history-heading">
      <header>
        <div>
          <p className="eyebrow">Immutable artifacts</p>
          <h4 id="release-history-heading">Release history</h4>
        </div>
        <span>{releases.length}</span>
      </header>
      {releases.length === 0 ? <p className="hint">No releases have been assembled yet.</p> : (
        <div className="history-table-scroll">
          <table>
            <thead><tr><th>Release</th><th>Source</th><th>Status</th><th>Installed</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{releases.map((release) => (
              <tr key={release.digest}>
                <td><strong>{release.versionLabel}</strong><code>{shortDigest(release.digest)}</code></td>
                <td>{formatRevisions(release.sourceRevisionNumbers)}</td>
                <td>
                  <span className={`promotion-status promotion-${release.promotionStatus}`}>
                    {release.promotionStatus}
                  </span>
                  {release.missingBindings.length === 0 ? null : (
                    <small>Missing {release.missingBindings.join(', ')}</small>
                  )}
                </td>
                <td>{formatTimestamp(release.installedAt)}</td>
                <td>{renderRollback(release, environmentName, pendingDigest, isWorking,
                  setPendingDigest, onRollback)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function renderRollback(
  release: DefinitionReleaseHistory,
  environmentName: string,
  pendingDigest: string | undefined,
  isWorking: boolean,
  setPendingDigest: (value: string | undefined) => void,
  onRollback: (releaseDigest: string) => Promise<void>,
): ReactElement | null {
  if (!release.canRollback) return null;
  if (pendingDigest !== release.digest) {
    return (
      <button type="button" disabled={isWorking} onClick={() => { setPendingDigest(release.digest); }}>
        Roll back
      </button>
    );
  }
  return (
    <div className="rollback-confirm" role="group" aria-label={`Confirm rollback to ${release.versionLabel}`}>
      <span>Activate {release.versionLabel} in {environmentName}?</span>
      <button type="button" disabled={isWorking} onClick={() => { setPendingDigest(undefined); }}>Cancel</button>
      <button type="button" disabled={isWorking} onClick={() => {
        void onRollback(release.digest).finally(() => { setPendingDigest(undefined); });
      }}>Confirm rollback</button>
    </div>
  );
}

function formatRevisions(values: readonly number[]): string {
  if (values.length === 0) return 'Imported';
  return values.map((value) => `r${value}`).join(', ');
}
