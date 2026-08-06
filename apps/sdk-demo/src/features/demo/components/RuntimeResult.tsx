import type { ReactElement } from 'react';
import type {
  DemoComparison,
  DemoDefinitionResult,
  DemoSubmissionResult,
} from '../api/DemoRuntimeTypes.js';

export function RuntimeResult({
  result,
  compact = false,
}: {
  readonly result: DemoDefinitionResult | DemoSubmissionResult | undefined;
  readonly compact?: boolean;
}): ReactElement | null {
  if (result === undefined) return null;
  const submission = 'outcome' in result ? result : undefined;

  return (
    <aside className={result.accepted ? 'runtime-result is-success' : 'runtime-result is-error'}>
      <strong>{result.accepted ? 'SDK accepted the operation' : 'SDK rejected the operation'}</strong>
      <ComparisonStatus comparison={result.comparison} />
      {submission === undefined || compact ? null : (
        <p>
          Outcome: {submission.outcome}. Score: {submission.score.earned}/
          {submission.score.possible}.
        </p>
      )}
      {result.diagnostics.length === 0 ? null : (
        <ul>
          {result.diagnostics.map((diagnostic) => (
            <li key={`${diagnostic.path}:${diagnostic.code}`}>
              {diagnostic.severity}: {diagnostic.code} at {diagnostic.path || '/'} —{' '}
              {diagnostic.message}
            </li>
          ))}
        </ul>
      )}
      {submission?.errors.length === 0 || submission === undefined ? null : (
        <ul>
          {submission.errors.map((error) => (
            <li key={`${error.name}:${error.kind}:${error.path}`}>
              {error.name}: {error.message || error.kind}
            </li>
          ))}
        </ul>
      )}
      {submission === undefined || compact ? null : (
        <details>
          <summary>Authoritative result JSON</summary>
          <pre>{JSON.stringify(submission.data, null, 2)}</pre>
        </details>
      )}
    </aside>
  );
}

function ComparisonStatus({
  comparison,
}: {
  readonly comparison: DemoComparison | undefined;
}): ReactElement | null {
  if (comparison === undefined) return null;
  return (
    <p className="comparison-status">
      {comparison.matched
        ? 'C# and TypeScript produced matching stable results.'
        : `Runtime differences: ${comparison.differences.join(', ')}.`}
    </p>
  );
}
