import { describe, expect, test } from 'vitest';
import {
  compareAnswerErrors,
  compareDefinitionResults,
  compareSubmissionResults,
} from '../../src/features/demo/api/DemoCompatibilityComparison.js';
import type {
  DemoDefinitionResult,
  DemoSubmissionResult,
} from '../../src/features/demo/api/DemoRuntimeTypes.js';

const definitionResult: DemoDefinitionResult = {
  runtime: 'dotnet',
  accepted: true,
  definition: { schemaVersion: 1, title: 'Demo' },
  diagnostics: [],
};

const submissionResult: DemoSubmissionResult = {
  runtime: 'dotnet',
  accepted: true,
  completed: true,
  outcome: 'advanced',
  data: { answer: 42 },
  score: { earned: 1, possible: 1, questionCount: 1, ratio: 1 },
  errors: [],
  diagnostics: [],
};

describe('SDK demo compatibility comparison', () => {
  test('matches definitions independent of object property order and diagnostic prose', () => {
    const typescript: DemoDefinitionResult = {
      ...definitionResult,
      runtime: 'typescript',
      definition: { title: 'Demo', schemaVersion: 1 },
      diagnostics: [],
    };

    expect(compareDefinitionResults(definitionResult, typescript)).toEqual({
      matched: true,
      differences: [],
    });
  });

  test('names every stable submission field that differs', () => {
    const typescript: DemoSubmissionResult = {
      ...submissionResult,
      runtime: 'typescript',
      data: { answer: 41 },
      score: { ...submissionResult.score, earned: 0, ratio: 0 },
    };

    expect(compareSubmissionResults(submissionResult, typescript)).toEqual({
      matched: false,
      differences: ['response data', 'quiz score'],
    });
  });

  test('compares error identity without coupling runtimes to message wording', () => {
    const dotnet = [{ name: 'email', kind: 'server', path: '', message: 'C# wording' }];
    const typescript = [{ name: 'email', kind: 'server', path: '', message: 'TS wording' }];

    expect(compareAnswerErrors(dotnet, typescript).matched).toBe(true);
  });
});
