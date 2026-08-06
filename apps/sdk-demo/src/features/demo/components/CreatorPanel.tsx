import { SurveyCreator } from '@kajay/creator-react';
import type { SurveyDefinition } from '@kajay/core';
import { useState } from 'react';
import type { ReactElement } from 'react';
import type { DemoRuntime } from '../api/DemoRuntime.js';
import type { DemoDefinitionResult } from '../api/DemoRuntimeTypes.js';
import { RuntimeResult } from './RuntimeResult.js';

export function CreatorPanel({
  definition,
  runtime,
  onDefinition,
}: {
  readonly definition: SurveyDefinition;
  readonly runtime: DemoRuntime;
  readonly onDefinition: (definition: SurveyDefinition) => void;
}): ReactElement {
  const [result, setResult] = useState<DemoDefinitionResult>();
  const [saveError, setSaveError] = useState<string>();

  return (
    <section className="demo-panel creator-panel" aria-labelledby="creator-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Author experience</p>
          <h2 id="creator-heading">Creator</h2>
        </div>
      </div>
      <p className="hint">
        Edit the survey, preview it, inspect its JSON, then Save to validate and canonicalize
        it with {runtime.name}.
      </p>
      <SurveyCreator
        value={definition}
        onChange={onDefinition}
        tabs={['design', 'preview', 'json']}
        save={async (candidate) => {
          setSaveError(undefined);
          try {
            const validation = await runtime.validateDefinition(candidate);
            setResult(validation);
            if (validation.accepted && validation.definition !== undefined) {
              onDefinition(validation.definition);
            }
            return validation.accepted;
          } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'Save failed.');
            return false;
          }
        }}
      />
      {saveError === undefined ? null : <p role="alert">{saveError}</p>}
      <RuntimeResult result={result} />
    </section>
  );
}
