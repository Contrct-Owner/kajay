import type { ReactElement } from 'react';
import type { DefinitionRevisionHistory } from '../api/DefinitionAuthoringTypes.js';
import { formatTimestamp, shortDigest } from './provenanceFormatting.js';

export function RevisionHistory({
  revisions,
}: {
  readonly revisions: readonly DefinitionRevisionHistory[];
}): ReactElement {
  return (
    <section className="provenance-card" aria-labelledby="revision-history-heading">
      <header>
        <div><p className="eyebrow">Authored snapshots</p><h4 id="revision-history-heading">Revision history</h4></div>
        <span>{revisions.length}</span>
      </header>
      {revisions.length === 0 ? <p className="hint">No revisions have been checkpointed yet.</p> : (
        <ol className="revision-list">{revisions.map((revision) => (
          <li key={revision.number}>
            <strong>Revision {revision.number}</strong>
            <span>Draft v{revision.sourceDraftVersion} · {revision.createdBy}</span>
            <time dateTime={revision.createdAt}>{formatTimestamp(revision.createdAt)}</time>
            <code>{shortDigest(revision.definitionDigest)}</code>
            <small>{revision.releaseDigests.length === 0
              ? 'No release assembled'
              : `${revision.releaseDigests.length} release link${revision.releaseDigests.length === 1 ? '' : 's'}`}</small>
          </li>
        ))}</ol>
      )}
    </section>
  );
}
