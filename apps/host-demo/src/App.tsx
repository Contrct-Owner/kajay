import { Survey } from '@kajay/react';
import type { ReactElement } from 'react';
import { CheckTimeline } from './CheckTimeline.js';
import { useDemoSurvey } from './useDemoSurvey.js';
import { useSurveyData } from './useSurveyData.js';
import { ValidationControls } from './ValidationControls.js';

function stableStringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function App(): ReactElement {
  const { model, diagnostics, canonical, isFixedPoint } = useDemoSurvey();
  const data = useSurveyData(model);

  return (
    <main className="host-demo">
      <Survey model={model} />

      <ValidationControls model={model} />

      {/* Diagnostic scaffolding for an intermittent stuck check, not a demo feature.
          Remove it once that is understood. */}
      <CheckTimeline model={model} />

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
    </main>
  );
}
