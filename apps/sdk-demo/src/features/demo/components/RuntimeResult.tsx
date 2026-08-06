import type { ReactElement } from 'react';
import type {
  DemoDefinitionResult,
  DemoSubmissionResult,
} from '../api/DemoRuntimeTypes.js';

export function RuntimeResult({
  result,
}: {
  readonly result: DemoDefinitionResult | DemoSubmissionResult | undefined;
}): ReactElement | null {
  if (result === undefined) return null;
  const submission = 'outcome' in result ? result : undefined;

  return (
    <aside className={result.accepted ? 'runtime-result is-success' : 'runtime-result is-error'}>
      <strong>{result.accepted ? 'SDK accepted the operation' : 'SDK rejected the operation'}</strong>
      {submission === undefined ? null : (
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
      {submission === undefined ? null : (
        <details>
          <summary>Authoritative result JSON</summary>
          <pre>{JSON.stringify(submission.data, null, 2)}</pre>
        </details>
      )}
    </aside>
  );
}
