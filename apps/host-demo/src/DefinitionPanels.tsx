import type { Diagnostic, SurveyDefinition } from '@kajay/core';
import type { ReactElement } from 'react';

function stableStringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export interface DefinitionPanelsProps {
  readonly data: Readonly<Record<string, unknown>>;
  readonly canonical: SurveyDefinition;
  readonly isFixedPoint: boolean;
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * What the model currently says, printed.
 *
 * Three panels rather than three components because they are one subject — the state a
 * scenario reads to check its work — and because splitting them further would put the
 * `data-testid`s every E2E scenario depends on in three files.
 *
 * On the page rather than in the console: a Playwright failure snapshot captures the
 * accessibility tree, so the answers, the canonical JSON and the diagnostics all survive
 * into the artefact of whatever went wrong.
 */
export function DefinitionPanels({
  data,
  canonical,
  isFixedPoint,
  diagnostics,
}: DefinitionPanelsProps): ReactElement {
  return (
    <>
      <section className="host-demo__panel" aria-label="Live answers">
        <h2>Answers</h2>
        <pre data-testid="survey-data">{stableStringify(data)}</pre>
      </section>

      <section className="host-demo__panel" aria-label="Canonical definition">
        <h2>Canonical JSON</h2>
        <p data-testid="round-trip-status">
          {isFixedPoint ? 'Round-trip is a fixed point' : 'Round-trip is NOT stable'}
        </p>
        <pre data-testid="canonical-json">{stableStringify(canonical)}</pre>
      </section>

      <section className="host-demo__panel" aria-label="Diagnostics">
        <h2>Diagnostics</h2>
        <ul data-testid="diagnostics">
          {diagnostics.map((diagnostic) => (
            <li key={`${diagnostic.code}:${diagnostic.path}`} data-code={diagnostic.code}>
              {`${diagnostic.severity}: ${diagnostic.message} (${diagnostic.path})`}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
