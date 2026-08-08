import type { ReactElement } from 'react';
import type { ReviewDecisionInput, ReviewTaskDetail } from '../api/ReviewWorkbenchTypes.js';
import { ReviewDecisionForm } from './ReviewDecisionForm.js';
import { ReviewHistory } from './ReviewHistory.js';
import { ReviewSubmission } from './ReviewSubmission.js';

export function ReviewTaskDetailPanel({
  detail,
  isWorking,
  onClose,
  onDecide,
}: {
  readonly detail: ReviewTaskDetail;
  readonly isWorking: boolean;
  readonly onClose: () => void;
  readonly onDecide: (input: ReviewDecisionInput) => void;
}): ReactElement {
  return (
    <div className="review-task-detail">
      <header className="panel-heading">
        <div>
          <p className="eyebrow">{detail.instance.environmentName} environment</p>
          <h2>{detail.instance.managedDefinitionName}</h2>
          <p className="hint">
            Submission {detail.submission.id} · round {detail.task.roundNumber}
          </p>
        </div>
        <button type="button" onClick={onClose}>Back to queue</button>
      </header>
      <ReviewSubmission detail={detail} />
      {detail.task.status === 'pending' ? (
        <ReviewDecisionForm disabled={isWorking} onDecide={onDecide} />
      ) : null}
      <ReviewHistory detail={detail} />
    </div>
  );
}
