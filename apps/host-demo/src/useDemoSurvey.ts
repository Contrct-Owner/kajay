import { parseSurvey, serializeSurvey } from '@kajay/core';
import type { Diagnostic, Survey, SurveyDefinition } from '@kajay/core';
import { useEffect, useMemo } from 'react';
import { loadChoicePage } from './choiceDirectory.js';
import { fetchJson } from './fetchJson.js';
import { validateOnServer } from './hostValidators.js';
import { clearProgress, readSavedProgress, saveProgress } from './savedProgress.js';
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
  const demo = useMemo(() => {
    const first = parseSurvey(surveyDefinition, { fetchJson, loadChoicePage });
    first.survey.validation.setServerValidator(validateOnServer);
    const saved = readSavedProgress();
    if (saved !== undefined) {
      // Before anything renders, so the respondent never sees the first page flash past
      // on the way to the one they were actually on.
      first.survey.restore(saved);
    }
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

  useEffect(() => {
    const { model } = demo;
    const save = (): void => {
      saveProgress(model.progress);
    };
    // The two events a partial save hangs on: answers as they are given, and the move
    // between pages — the `sendResultOnPageNext` pattern, which a real host serves by
    // posting the same snapshot instead of storing it.
    const stopValue = model.onValueChanged.add(save);
    const stopPage = model.onCurrentPageChanged.add(save);
    // A finished survey has nothing to resume. Leaving the snapshot behind would put a
    // respondent back into a survey they already submitted.
    const stopComplete = model.onComplete.add(clearProgress);
    return () => {
      stopValue();
      stopPage();
      stopComplete();
    };
  }, [demo]);

  return demo;
}
