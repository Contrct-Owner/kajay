import { parseSurvey } from '@kajay/core';
import { Survey } from '@kajay/react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { QUICKSTART_DEFINITION } from '../examples/runtimeExamples.js';

export function QuickstartDemo(): ReactElement {
  const [run, setRun] = useState(0);
  const [submitted, setSubmitted] = useState<Readonly<Record<string, unknown>>>();
  const model = useMemo(() => parseSurvey(QUICKSTART_DEFINITION).survey, [run]);

  useEffect(
    () => model.onComplete.add(({ data }) => { setSubmitted(data); }),
    [model],
  );

  return (
    <div className="my-6 rounded-xl border border-border bg-card p-4 sm:p-6">
      <Survey model={model} />
      {submitted === undefined ? null : (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-sm font-medium">Submitted data</p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(submitted, undefined, 2)}
          </pre>
          <button
            type="button"
            className="mt-3 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
            onClick={() => {
              setSubmitted(undefined);
              setRun((current) => current + 1);
            }}
          >
            Run again
          </button>
        </div>
      )}
    </div>
  );
}
