import { parseSurvey, serializeSurvey } from '@kajay/core';
import type { Diagnostic, Survey, SurveyDefinition } from '@kajay/core';
import { useMemo } from 'react';
import { loadChoicePage } from './choiceDirectory.js';
import { fetchJson } from './fetchJson.js';
import { validateOnServer } from './hostValidators.js';
import { surveyDefinition } from './surveyDefinition.js';

export interface DemoSurvey {
  readonly model: Survey;
  readonly diagnostics: readonly Diagnostic[];
  readonly canonical: SurveyDefinition;
  readonly isFixedPoint: boolean;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/**
 * Builds the demo's model, and checks the round-trip while it is at it.
 *
 * Its own hook because it is the whole of what the host does at startup — parse,
 * install the seams it owns, and confirm ADR-0002 holds — and that is a different job
 * from laying the page out.
 */
export function useDemoSurvey(): DemoSurvey {
  return useMemo(() => {
    const first = parseSurvey(surveyDefinition, { fetchJson, loadChoicePage });
    first.survey.validation.setServerValidator(validateOnServer);
    const firstCanonical = serializeSurvey(first.survey);
    // ADR-0002: the first pass may canonicalise; the second must not change a byte.
    const secondCanonical = serializeSurvey(parseSurvey(firstCanonical).survey);
    return {
      model: first.survey,
      diagnostics: first.diagnostics,
      canonical: firstCanonical,
      isFixedPoint: stableStringify(firstCanonical) === stableStringify(secondCanonical),
    };
  }, []);
}
