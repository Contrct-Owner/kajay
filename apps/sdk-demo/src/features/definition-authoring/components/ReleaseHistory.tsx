import { useState } from 'react';
import type { ReactElement } from 'react';
import type { DefinitionReleaseHistory } from '../api/DefinitionAuthoringTypes.js';
import type { ReleasePreflight } from '../api/DefinitionAuthoringTypes.js';
import type { ReleaseHistoryFilters } from '../hooks/useDefinitionHistory.js';
import type { CursorPageState } from '../hooks/useCursorPage.js';
import type { ReleaseComparisonState } from '../hooks/useReleaseComparison.js';
import { HistoryControls } from './HistoryControls.js';
import { ReleaseComparisonPanel } from './ReleaseComparisonPanel.js';
import { formatTimestamp, shortDigest } from './provenanceFormatting.js';

export function ReleaseHistory({
  state,
  environmentName,
  isWorking,
  preflight,
  comparison,
  onActivate,
  onPreflight,
}: {
  readonly state: CursorPageState<DefinitionReleaseHistory, ReleaseHistoryFilters>;
  readonly environmentName: string;
  readonly isWorking: boolean;
  readonly preflight: ReleasePreflight | undefined;
  readonly comparison: ReleaseComparisonState;
  readonly onActivate: (releaseDigest: string) => Promise<void>;
  readonly onPreflight: (releaseDigest: string) => Promise<void>;
}): ReactElement {
  const [pendingDigest, setPendingDigest] = useState<string>();
  const releases = state.page.items;

  return (
    <section className="provenance-card release-history" aria-labelledby="release-history-heading">
      <header>
        <div>
          <p className="eyebrow">Immutable artifacts</p>
          <h4 id="release-history-heading">Release history</h4>
        </div>
        <span>{releases.length}</span>
      </header>
      <HistoryControls label="Release" query={state.filters.query} status={state.filters.status}
        includeStatus isLoading={state.isLoading} canLoadMore={state.page.nextCursor !== undefined}
        onApply={(query, status) => state.applyFilters({ query, status })}
        onLoadMore={state.loadMore} />
      {state.error === undefined ? null : <p className="provenance-error" role="alert">{state.error}</p>}
      {releases.length === 0 ? <p className="hint">No releases have been assembled yet.</p> : (
        <ReleaseTable releases={releases} environmentName={environmentName}
          pendingDigest={pendingDigest} isWorking={isWorking}
          setPendingDigest={setPendingDigest} onActivate={onActivate}
          onPreflight={onPreflight} comparison={comparison} />
      )}
      <PreflightStatus preflight={preflight} />
      <ReleaseComparisonPanel state={comparison} />
    </section>
  );
}

function PreflightStatus({ preflight }: {
  readonly preflight: ReleasePreflight | undefined;
}): ReactElement | null {
  if (preflight === undefined) return null;
  return (
    <p className="hint" role="status">
      Preflight for {preflight.versionLabel}: {preflight.compatible
        ? 'ready to activate'
        : `blocked by ${preflight.missingBindings.join(', ')}`}
      {preflight.requiresApproval ? '; approval required' : ''}
    </p>
  );
}

function ReleaseTable({
  releases, environmentName, pendingDigest, isWorking,
  setPendingDigest, onActivate, onPreflight,
  comparison,
}: {
  readonly releases: readonly DefinitionReleaseHistory[];
  readonly environmentName: string;
  readonly pendingDigest: string | undefined;
  readonly isWorking: boolean;
  readonly setPendingDigest: (value: string | undefined) => void;
  readonly onActivate: (releaseDigest: string) => Promise<void>;
  readonly onPreflight: (releaseDigest: string) => Promise<void>;
  readonly comparison: ReleaseComparisonState;
}): ReactElement {
  return (
    <div className="history-table-scroll"><table>
      <thead><tr><th>Release</th><th>Source</th><th>Status</th><th>Installed</th>
        <th><span className="sr-only">Actions</span></th></tr></thead>
      <tbody>{releases.map((release) => (
        <tr key={release.digest}>
          <td><strong>{release.versionLabel}</strong><code>{shortDigest(release.digest)}</code></td>
          <td>{formatRevisions(release.sourceRevisionNumbers)}</td>
          <td><span className={`promotion-status promotion-${release.promotionStatus}`}>
            {release.promotionStatus}</span>
            {release.missingBindings.length === 0 ? null
              : <small>Missing {release.missingBindings.join(', ')}</small>}</td>
          <td>{formatTimestamp(release.installedAt)}</td>
          <td>{renderActions(release, environmentName, pendingDigest, isWorking,
            setPendingDigest, onActivate, onPreflight, comparison)}</td>
        </tr>
      ))}</tbody>
    </table></div>
  );
}

function renderActions(
  release: DefinitionReleaseHistory,
  environmentName: string,
  pendingDigest: string | undefined,
  isWorking: boolean,
  setPendingDigest: (value: string | undefined) => void,
  onActivate: (releaseDigest: string) => Promise<void>,
  onPreflight: (releaseDigest: string) => Promise<void>,
  comparison: ReleaseComparisonState,
): ReactElement {
  if (pendingDigest !== release.digest) {
    return (
      <div className="release-actions-cell">
        {!release.canActivate && release.promotionStatus !== 'active' ? (
          <button type="button" disabled={isWorking}
            onClick={() => { void comparison.review(release.digest); }}>
            Review changes<span className="sr-only"> for {release.versionLabel}</span>
          </button>
        ) : null}
        <button type="button" disabled={isWorking}
          onClick={() => { void onPreflight(release.digest); }}>Preflight</button>
        {release.canActivate ? (
          <button type="button" disabled={isWorking}
            onClick={() => {
              setPendingDigest(release.digest); void comparison.review(release.digest);
            }}>
            {release.canRollback ? 'Review & roll back' : 'Review & activate'}
          </button>
        ) : null}
      </div>
    );
  }
  const action = release.canRollback ? 'rollback' : 'activation';
  return (
    <div className="rollback-confirm" role="group" aria-label={`Confirm ${action} of ${release.versionLabel}`}>
      <span>Activate {release.versionLabel} in {environmentName}?</span>
      <button type="button" disabled={isWorking} onClick={() => {
        setPendingDigest(undefined); comparison.clear();
      }}>Cancel</button>
      <button type="button" disabled={isWorking || comparison.isLoading
        || comparison.result?.target.digest !== release.digest} onClick={() => {
        void onActivate(release.digest).finally(() => { setPendingDigest(undefined); });
      }}>{release.canRollback ? 'Confirm rollback' : 'Confirm activation'}</button>
    </div>
  );
}

function formatRevisions(values: readonly number[]): string {
  if (values.length === 0) return 'Imported';
  return values.map((value) => `r${value}`).join(', ');
}
