import type { ReactElement } from 'react';
import type { ReviewTaskDetail } from '../api/ReviewWorkbenchTypes.js';

export function ReviewHistory({ detail }: { readonly detail: ReviewTaskDetail }): ReactElement {
  return (
    <div className="review-history-grid">
      <section aria-labelledby="round-history-heading">
        <h3 id="round-history-heading">Review rounds</h3>
        <ol>
          {detail.reviewRounds.map((round) => (
            <li key={round.id}>
              <strong>Round {round.roundNumber}: {round.status}</strong>
              {round.decidedBy === undefined ? null : <span> by {round.decidedBy}</span>}
              {round.comment === undefined ? null : <blockquote>{round.comment}</blockquote>}
            </li>
          ))}
        </ol>
        {detail.reviewRoundsTruncated ? <p>Showing the latest 100 review rounds.</p> : null}
      </section>
      <section aria-labelledby="review-audit-heading">
        <h3 id="review-audit-heading">Workflow audit</h3>
        <ol>
          {detail.auditHistory.map((event) => (
            <li key={event.sequence}>
              <strong>{event.eventType}</strong>
              <span> · {event.actorId}</span>
            </li>
          ))}
        </ol>
        {detail.auditHistoryTruncated ? <p>Showing the latest 100 audit events.</p> : null}
      </section>
    </div>
  );
}
