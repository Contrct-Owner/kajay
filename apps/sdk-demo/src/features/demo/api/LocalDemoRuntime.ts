import { parseSurvey, scoreQuiz, serializeSurvey } from '@kajay/core';
import type { Diagnostic, SurveyDefinition } from '@kajay/core';
import type { DemoRuntime } from './DemoRuntime.js';
import type {
  DemoDefinitionResult,
  DemoDiagnostic,
  DemoSubmissionError,
  DemoSubmissionResult,
} from './DemoRuntimeTypes.js';

function toDiagnostic(diagnostic: Diagnostic): DemoDiagnostic {
  return {
    code: diagnostic.code,
    path: diagnostic.path,
    severity: diagnostic.severity,
    message: diagnostic.message,
  };
}

function rejectedDefinition(error: unknown): DemoDefinitionResult {
  return {
    runtime: 'typescript',
    accepted: false,
    diagnostics: [
      {
        code: 'invalid-json-definition',
        path: '',
        severity: 'error',
        message: error instanceof Error ? error.message : 'The definition could not be read.',
      },
    ],
  };
}

/** Local adapter: the browser runs the TypeScript SDK without an API process. */
export class LocalDemoRuntime implements DemoRuntime {
  readonly name = 'typescript' as const;

  async loadDefinition(): Promise<DemoDefinitionResult> {
    const response = await fetch('/demo-survey.json');
    if (!response.ok) throw new Error('The demo survey could not be loaded.');
    return this.validateDefinition((await response.json()) as SurveyDefinition);
  }

  validateDefinition(definition: SurveyDefinition): Promise<DemoDefinitionResult> {
    try {
      const parsed = parseSurvey(definition);
      const diagnostics = parsed.diagnostics.map(toDiagnostic);
      return Promise.resolve({
        runtime: this.name,
        accepted: diagnostics.every(({ severity }) => severity !== 'error'),
        definition: serializeSurvey(parsed.survey),
        diagnostics,
      });
    } catch (error) {
      return Promise.resolve(rejectedDefinition(error));
    }
  }

  async submit(
    definition: SurveyDefinition,
    data: Readonly<Record<string, unknown>>,
  ): Promise<DemoSubmissionResult> {
    const validated = await this.validateDefinition(definition);
    if (!validated.accepted || validated.definition === undefined) {
      return this.invalidSubmission(validated);
    }

    const survey = parseSurvey(validated.definition).survey;
    survey.setData(data);
    const isValid = survey.validation.validateAll();
    const serverRejected = data['email'] === 'blocked@example.com';
    const score = scoreQuiz(survey);
    const errors = survey.questions.flatMap((question) =>
      question.errors.map((error) => ({
        name: question.name,
        kind: error.kind,
        message: error.text,
        path: error.path ?? '',
      })),
    );
    if (serverRejected) {
      errors.push({
        name: 'email',
        kind: 'server',
        message: 'This demonstration address is blocked by the host validator.',
        path: '',
      });
    }
    const accepted = isValid && !serverRejected;
    return {
      runtime: this.name,
      accepted,
      completed: accepted,
      outcome: accepted ? 'advanced' : 'blocked',
      data: survey.data,
      score: {
        earned: score.correct,
        possible: score.total,
        questionCount: score.questionCount,
        ratio: score.ratio,
      },
      errors,
      diagnostics: validated.diagnostics,
    };
  }

  validateAnswers(
    data: Readonly<Record<string, unknown>>,
    questionNames: readonly string[],
  ): Promise<readonly DemoSubmissionError[]> {
    if (questionNames.includes('email') && data['email'] === 'blocked@example.com') {
      return Promise.resolve([
        {
          name: 'email',
          kind: 'server',
          message: 'This demonstration address is blocked by the host validator.',
          path: '',
        },
      ]);
    }
    return Promise.resolve([]);
  }

  private invalidSubmission(validated: DemoDefinitionResult): DemoSubmissionResult {
    return {
      runtime: this.name,
      accepted: false,
      completed: false,
      outcome: 'invalid-definition',
      data: {},
      score: { earned: 0, possible: 0, questionCount: 0, ratio: 0 },
      errors: [],
      diagnostics: validated.diagnostics,
    };
  }
}
