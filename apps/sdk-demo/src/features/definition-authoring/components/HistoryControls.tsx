import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type { PromotionStatus } from '../api/DefinitionAuthoringTypes.js';

export function HistoryControls({
  label, query, status, includeStatus = false, isLoading, canLoadMore,
  onApply, onLoadMore,
}: {
  readonly label: string;
  readonly query: string;
  readonly status?: PromotionStatus | undefined;
  readonly includeStatus?: boolean;
  readonly isLoading: boolean;
  readonly canLoadMore: boolean;
  readonly onApply: (query: string, status: PromotionStatus | undefined) => Promise<void>;
  readonly onLoadMore: () => Promise<void>;
}): ReactElement {
  const [draftQuery, setDraftQuery] = useState(query);
  const [draftStatus, setDraftStatus] = useState<PromotionStatus | undefined>(status);
  useEffect(() => { setDraftQuery(query); }, [query]);
  useEffect(() => { setDraftStatus(status); }, [status]);
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    void onApply(draftQuery.trim(), draftStatus);
  };
  return (
    <div className="history-controls">
      <form onSubmit={submit} role="search">
        <label>{label} search<input value={draftQuery}
          onChange={(event) => { setDraftQuery(event.target.value); }} /></label>
        {includeStatus ? <label>Status<select value={draftStatus ?? ''}
          onChange={(event) => { setDraftStatus(readStatus(event.target.value)); }}>
          <option value="">All</option><option value="active">Active</option>
          <option value="ready">Ready</option><option value="blocked">Blocked</option>
        </select></label> : null}
        <button type="submit" aria-label={`Apply ${label} filters`} disabled={isLoading}>Apply</button>
        <button type="button" aria-label={`Clear ${label} filters`}
          disabled={isLoading || (query === '' && status === undefined)}
          onClick={() => {
            const clearedStatus = readStatus('');
            setDraftQuery(''); setDraftStatus(clearedStatus); void onApply('', clearedStatus);
          }}>
          Clear
        </button>
      </form>
      {canLoadMore ? <button type="button" aria-label={`Load more ${label} history`} disabled={isLoading}
        onClick={() => { void onLoadMore(); }}>{isLoading ? 'Loading…' : 'Load more'}</button> : null}
    </div>
  );
}

function readStatus(value: string): PromotionStatus | undefined {
  return value === 'active' || value === 'ready' || value === 'blocked' ? value : undefined;
}
