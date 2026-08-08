import { parseSurvey } from '@kajay/core';
import type { SurveySnapshot } from '@kajay/core';
import { Survey } from '@kajay/react';
import { useEffect, useMemo } from 'react';
import type { ReactElement } from 'react';
import type { SurveyDefinition } from '@kajay/core';

export function WorkflowSurvey({
  definition,
  round,
  onSubmit,
}: {
  readonly definition: SurveyDefinition;
  readonly round: number;
  readonly onSubmit: (snapshot: SurveySnapshot) => void;
}): ReactElement {
  const model = useMemo(() => parseSurvey(definition).survey, [definition, round]);
  useEffect(() => model.onComplete.add(() => { onSubmit(model.createSnapshot()); }), [model, onSubmit]);
  return <Survey model={model} />;
}
