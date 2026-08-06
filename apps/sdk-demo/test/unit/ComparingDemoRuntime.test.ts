import type { SurveyDefinition } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { ComparingDemoRuntime } from '../../src/features/demo/api/ComparingDemoRuntime.js';
import type { DemoRuntime } from '../../src/features/demo/api/DemoRuntime.js';
import type {
  DemoDefinitionResult,
  DemoSubmissionError,
  DemoSubmissionResult,
} from '../../src/features/demo/api/DemoRuntimeTypes.js';

const definition: SurveyDefinition = { schemaVersion: 1, pages: [] };

describe('ComparingDemoRuntime', () => {
  test('fans out definition validation and reports matching stable results', async () => {
    const calls: string[] = [];
    const runtime = createComparingRuntime(calls);

    const result = await runtime.validateDefinition(definition);

    expect(calls).toEqual(['dotnet:definition', 'typescript:definition']);
    expect(result).toMatchObject({
      runtime: 'compare',
      accepted: true,
      comparison: { matched: true, differences: [] },
    });
  });

  test('rejects a submission when either runtime produces different data', async () => {
    const runtime = new ComparingDemoRuntime(
      runtimeStub('dotnet'),
      runtimeStub('typescript', { submissionData: { answer: 'different' } }),
    );

    const result = await runtime.submit(definition, { answer: 'same' });

    expect(result.accepted).toBe(false);
    expect(result.comparison).toEqual({ matched: false, differences: ['response data'] });
  });

  test('fails closed when answer validation identities disagree', async () => {
    const runtime = new ComparingDemoRuntime(
      runtimeStub('dotnet'),
      runtimeStub('typescript', {
        answerErrors: [{ name: 'email', kind: 'server', message: 'Blocked.', path: '' }],
      }),
    );

    await expect(runtime.validateAnswers({}, ['email'])).rejects.toThrow(
      'SDK runtimes disagreed about answer validation errors.',
    );
  });
});

function createComparingRuntime(calls: string[]): ComparingDemoRuntime {
  return new ComparingDemoRuntime(runtimeStub('dotnet', { calls }), runtimeStub('typescript', { calls }));
}

interface StubOptions {
  readonly calls?: string[];
  readonly submissionData?: Readonly<Record<string, unknown>>;
  readonly answerErrors?: readonly DemoSubmissionError[];
}

function runtimeStub(name: 'dotnet' | 'typescript', options: StubOptions = {}): DemoRuntime {
  const definitionResult: DemoDefinitionResult = {
    runtime: name,
    accepted: true,
    definition,
    diagnostics: [],
  };
  return {
    name,
    loadDefinition: () => Promise.resolve(definitionResult),
    validateDefinition: () => {
      options.calls?.push(`${name}:definition`);
      return Promise.resolve(definitionResult);
    },
    validateAnswers: () => Promise.resolve(options.answerErrors ?? []),
    submit: (_definition, data) =>
      Promise.resolve(submissionResult(name, options.submissionData ?? data)),
  };
}

function submissionResult(
  runtime: 'dotnet' | 'typescript',
  data: Readonly<Record<string, unknown>>,
): DemoSubmissionResult {
  return {
    runtime,
    accepted: true,
    completed: true,
    outcome: 'advanced',
    data,
    score: { earned: 0, possible: 0, questionCount: 0, ratio: 0 },
    errors: [],
    diagnostics: [],
  };
}
