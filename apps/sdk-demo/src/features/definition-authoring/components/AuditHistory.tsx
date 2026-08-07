import type { ReactElement } from 'react';
import type { ManagementAuditEvent } from '../api/DefinitionAuthoringTypes.js';
import { formatTimestamp, shortDigest } from './provenanceFormatting.js';

export function AuditHistory({
  events,
}: {
  readonly events: readonly ManagementAuditEvent[];
}): ReactElement {
  return (
    <section className="provenance-card audit-history" aria-labelledby="audit-history-heading">
      <header>
        <div><p className="eyebrow">Traceability</p><h4 id="audit-history-heading">Audit history</h4></div>
        <span>Latest {events.length}</span>
      </header>
      {events.length === 0 ? <p className="hint">No management events recorded yet.</p> : (
        <ol>{events.map((event) => (
          <li key={event.id}>
            <span className="audit-marker" aria-hidden="true" />
            <div>
              <strong>{formatEventType(event.eventType)}</strong>
              <span>{event.actorId} · {formatTimestamp(event.occurredAt)}</span>
              <code>{formatSubject(event.subject)}</code>
            </div>
          </li>
        ))}</ol>
      )}
    </section>
  );
}

function formatEventType(value: string): string {
  return value.split('-').map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(' ');
}

function formatSubject(value: string): string {
  return value.startsWith('sha256:') ? shortDigest(value) : value;
}
