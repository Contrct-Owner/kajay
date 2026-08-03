import { Survey } from '@kajay/react';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { CheckTimeline } from './CheckTimeline.js';
import { renderEmphasis } from './renderEmphasis.js';
import { LocalePicker } from './LocalePicker.js';
import { ThemePicker, variablesFor } from './ThemePicker.js';
import { useDemoSurvey } from './useDemoSurvey.js';
import { useSurveyData } from './useSurveyData.js';
import { ValidationControls } from './ValidationControls.js';

function stableStringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function App(): ReactElement {
  const { model, diagnostics, canonical, isFixedPoint } = useDemoSurvey();
  const data = useSurveyData(model);
  const [theme, setTheme] = useState('light');

  return (
    <main className="host-demo" data-theme={theme}>
      <ThemePicker selected={theme} onSelect={setTheme} />
      <LocalePicker model={model} />

      <Survey
        model={model}
        theme={variablesFor(theme)}
        // The host's own classes, added to the library's — checklist I4.
        css={{ survey: 'host-demo__survey' }}
        // The markdown seam — checklist I6. Deliberately the smallest thing that could
        // be called markdown: *emphasis*, rendered by the host as a real element. A
        // library that shipped a markdown parser would be shipping its escaping rules
        // and its vulnerabilities too.
        renderText={renderEmphasis}
      />

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
