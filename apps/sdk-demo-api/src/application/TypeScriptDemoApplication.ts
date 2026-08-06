import {
  parseSurvey,
  parseSurveySnapshot,
  scoreQuiz,
  serializeSurvey,
} from '@kajay/core';
import type { AdvanceOutcome, Diagnostic, Survey, SurveyDefinition } from '@kajay/core';
import type {
  DemoDefinitionResult,
  DemoDiagnostic,
  DemoSubmissionError,
  DemoSubmissionResult,
  DemoSnapshotResult,
} from './DemoContract.js';
import { validateDemoAnswers } from './DemoHostValidator.js';

const runtime = 'typescript' as const;

export class TypeScriptDemoApplication {
  readonly #definition: SurveyDefinition;

  constructor(definition: SurveyDefinition) {
    this.#definition = definition;
  }

  loadDefinition(): DemoDefinitionResult {
    return this.validateDefinition(this.#definition);
  }

  validateDefinition(definition: unknown): DemoDefinitionResult {
    try {
      const parsed = parseSurvey(definition);
      const diagnostics = parsed.diagnostics.map(toDiagnostic);
      return {
        runtime,
        accepted: diagnostics.every(({ severity }) => severity !== 'error'),
        definition: serializeSurvey(parsed.survey),
        diagnostics,
      };
    } catch (error) {
      return invalidDefinition(error);
    }
  }

  validateAnswers(
    data: Readonly<Record<string, unknown>>,
    questionNames: readonly string[],
  ): readonly DemoSubmissionError[] {
    return validateDemoAnswers(data, questionNames);
  }

  submit(
    definition: unknown,
    data: Readonly<Record<string, unknown>>,
  ): DemoSubmissionResult {
    const validated = this.validateDefinition(definition);
    if (!validated.accepted || validated.definition === undefined) {
      return invalidSubmission(validated.diagnostics);
    }
    const serverErrors = validateDemoAnswers(data, ['email']);
    const survey = parseSurvey(validated.definition).survey;
    survey.setData(data);
    const outcome = serverErrors.length === 0 ? advanceToCompletion(survey) : 'blocked';
    return submissionResult(survey, outcome, serverErrors, validated.diagnostics);
  }

  roundTripSnapshot(
    definition: unknown,
    data: Readonly<Record<string, unknown>>,
  ): DemoSnapshotResult {
    const sourceResult = parseSurvey(definition);
    sourceResult.survey.setData(data);
    const snapshot = JSON.parse(
      JSON.stringify(sourceResult.survey.createSnapshot()),
    ) as Readonly<Record<string, unknown>>;
    const restored = parseSurvey(definition).survey;
    restored.restoreSnapshot(parseSurveySnapshot(JSON.stringify(snapshot)));
    return {
      runtime,
      definitionDigest: sourceResult.definitionDigest,
      snapshot,
      restoredData: restored.data,
    };
  }
}

function advanceToCompletion(survey: Survey): AdvanceOutcome {
  let outcome: AdvanceOutcome = 'blocked';
  for (let attempt = 0; attempt <= survey.pageCount && !survey.isCompleted; attempt += 1) {
    outcome = survey.nextPageOrComplete();
    if (outcome !== 'advanced') break;
  }
  return outcome;
}

function submissionResult(
  survey: Survey,
  outcome: AdvanceOutcome,
  serverErrors: readonly DemoSubmissionError[],
  diagnostics: readonly DemoDiagnostic[],
): DemoSubmissionResult {
  const score = scoreQuiz(survey);
  const errors = survey.questions.flatMap((question) =>
    question.errors.map((error) => ({
      name: question.name,
      kind: error.kind,
      message: error.text,
      path: error.path ?? '',
    })),
  );
  return {
    runtime,
    accepted: survey.isCompleted && serverErrors.length === 0,
    completed: survey.isCompleted,
    outcome,
    data: survey.data,
    score: {
      earned: score.correct,
      possible: score.total,
      questionCount: score.questionCount,
      ratio: score.ratio,
    },
    errors: [...errors, ...serverErrors],
    diagnostics,
  };
}

function toDiagnostic(diagnostic: Diagnostic): DemoDiagnostic {
  return {
    code: diagnostic.code,
    path: diagnostic.path,
    severity: diagnostic.severity,
    message: diagnostic.message,
  };
}

function invalidDefinition(error: unknown): DemoDefinitionResult {
  return {
    runtime,
    accepted: false,
    diagnostics: [{
      code: 'invalid-json-definition',
      path: '',
      severity: 'error',
      message: error instanceof Error ? error.message : 'The definition could not be read.',
    }],
  };
}

function invalidSubmission(diagnostics: readonly DemoDiagnostic[]): DemoSubmissionResult {
  return {
    runtime,
    accepted: false,
    completed: false,
    outcome: 'invalid-definition',
    data: {},
    score: { earned: 0, possible: 0, questionCount: 0, ratio: 0 },
    errors: [],
    diagnostics,
  };
}
