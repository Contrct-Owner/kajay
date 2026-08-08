import type { ReactElement } from 'react';
import type { ReviewQueueItem, ReviewQueueStatus } from '../api/ReviewWorkbenchTypes.js';

export function ReviewTaskList({
  items,
  isLoading,
  status,
  onOpen,
}: {
  readonly items: readonly ReviewQueueItem[];
  readonly isLoading: boolean;
  readonly status: ReviewQueueStatus;
  readonly onOpen: (taskId: string) => void;
}): ReactElement {
  if (items.length === 0) {
    return isLoading
      ? <p role="status">Loading review tasks…</p>
      : <p className="review-empty">No {status} review tasks.</p>;
  }
  return (
    <ol className="review-task-list">
      {items.map((item) => (
        <li key={item.task.id}>
          <button
            type="button"
            className="review-task-card"
            onClick={() => { onOpen(item.task.id); }}
          >
            <span>
              <strong>{item.managedDefinitionName}</strong>
              <small>{item.environmentName} · {item.task.stepKey}</small>
            </span>
            <span>
              <strong>Round {item.task.roundNumber}</strong>
              <small>{formatDate(item.task.createdAt)}</small>
            </span>
            <span className={`history-status is-${item.task.status}`}>{item.task.status}</span>
            <span className="sr-only">
              Review {item.managedDefinitionName} round {item.task.roundNumber}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}
