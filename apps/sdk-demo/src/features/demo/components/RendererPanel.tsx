import { parseSurvey } from '@kajay/core';
import type { Survey as SurveyModel, SurveyDefinition } from '@kajay/core';
import { Survey } from '@kajay/react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { DemoRuntime } from '../api/DemoRuntime.js';
import type { DemoSubmissionResult } from '../api/DemoRuntimeTypes.js';
import { RuntimeResult } from './RuntimeResult.js';

export function RendererPanel({
  definition,
  runtime,
}: {
  readonly definition: SurveyDefinition;
  readonly runtime: DemoRuntime;
}): ReactElement {
  const { model, result, submitError, isSubmitting, restart } = useSubmissionModel(
    definition,
    runtime,
  );

  return (
    <section className="demo-panel" aria-labelledby="renderer-heading">
      <RendererHeading onRestart={restart} />
      <p className="hint">
        Try <code>blocked@example.com</code> to see the host-side server validator refuse
        forward navigation.
      </p>
      <Survey model={model} />
      {isSubmitting ? <p role="status">Confirming the result with {runtime.name}…</p> : null}
      {submitError === undefined ? null : <p role="alert">{submitError}</p>}
      <RuntimeResult result={result} />
    </section>
  );
}

interface SubmissionModelState {
  readonly model: SurveyModel;
  readonly result: DemoSubmissionResult | undefined;
  readonly submitError: string | undefined;
  readonly isSubmitting: boolean;
  readonly restart: () => void;
}

function useSubmissionModel(
  definition: SurveyDefinition,
  runtime: DemoRuntime,
): SubmissionModelState {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<DemoSubmissionResult>();
  const [submitError, setSubmitError] = useState<string>();
  const [isSubmitting, setSubmitting] = useState(false);
  const model = useMemo(() => {
    const survey = parseSurvey(definition).survey;
    survey.validation.setServerValidator(async ({ data, questionNames }) => {
      const errors = await runtime.validateAnswers(data, questionNames);
      return errors.map((error) => ({ questionName: error.name, text: error.message }));
    });
    return survey;
  }, [definition, attempt, runtime]);

  useEffect(() => {
    return model.onComplete.add(({ data }) => {
      setSubmitting(true);
      setSubmitError(undefined);
      void runtime
        .submit(definition, data)
        .then(setResult)
        .catch((error: unknown) => {
          setSubmitError(error instanceof Error ? error.message : 'Submission failed.');
        })
        .finally(() => {
          setSubmitting(false);
        });
    });
  }, [definition, model, runtime]);

  return {
    model,
    result,
    submitError,
    isSubmitting,
    restart: () => {
      setAttempt((value) => value + 1);
      setResult(undefined);
      setSubmitError(undefined);
    },
  };
}

function RendererHeading({ onRestart }: { readonly onRestart: () => void }): ReactElement {
  return (
    <div className="panel-heading">
      <div>
        <p className="eyebrow">Respondent experience</p>
        <h2 id="renderer-heading">Renderer</h2>
      </div>
      <button type="button" onClick={onRestart}>Start over</button>
    </div>
  );
}
