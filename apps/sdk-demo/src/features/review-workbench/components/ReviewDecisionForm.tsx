import { useState } from 'react';
import type { ReactElement } from 'react';
import type { ReviewDecision, ReviewDecisionInput } from '../api/ReviewWorkbenchTypes.js';

export function ReviewDecisionForm({
  disabled,
  onDecide,
}: {
  readonly disabled: boolean;
  readonly onDecide: (input: ReviewDecisionInput) => void;
}): ReactElement {
  const [comment, setComment] = useState('');
  const [validation, setValidation] = useState<string>();
  const decide = (decision: ReviewDecision): void => {
    const normalized = comment.trim();
    if (decision === 'request-changes' && normalized.length === 0) {
      setValidation('Explain what the respondent needs to change.');
      return;
    }
    setValidation(undefined);
    onDecide({ decision, ...(normalized.length === 0 ? {} : { comment: normalized }) });
  };
  return (
    <form className="review-decision" onSubmit={(event) => { event.preventDefault(); }}>
      <label>
        Decision comment
        <textarea
          value={comment}
          maxLength={2000}
          disabled={disabled}
          onChange={(event) => { setComment(event.target.value); }}
        />
      </label>
      {validation === undefined ? null : <p role="alert">{validation}</p>}
      <div className="review-decision-actions">
        <button type="button" disabled={disabled} onClick={() => { decide('approve'); }}>
          Approve
        </button>
        <button type="button" disabled={disabled} onClick={() => { decide('deny'); }}>
          Deny
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => { decide('request-changes'); }}
        >
          Request changes
        </button>
      </div>
    </form>
  );
}
