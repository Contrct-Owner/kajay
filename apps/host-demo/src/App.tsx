import { Survey } from '@kajay/react';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { CheckTimeline } from './CheckTimeline.js';
import { DefinitionPanels } from './DefinitionPanels.js';
import { Designer } from './Designer.js';
import { EventLog } from './EventLog.js';
import { renderEmphasis } from './renderEmphasis.js';
import { LocalePicker } from './LocalePicker.js';
import { ThemePicker, variablesFor } from './ThemePicker.js';
import { useDemoSurvey } from './useDemoSurvey.js';
import { useSurveyData } from './useSurveyData.js';
import { ValidationControls } from './ValidationControls.js';

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

      {/* The typed event surface, heard the way a host hears it — checklist A7. */}
      <EventLog model={model} />

      {/* Phase 3 begins: the Creator's first piece, driven by the host — checklist K1. */}
      <Designer theme={variablesFor(theme)} />

      <DefinitionPanels
        data={data}
        canonical={canonical}
        isFixedPoint={isFixedPoint}
        diagnostics={diagnostics}
      />
    </main>
  );
}
