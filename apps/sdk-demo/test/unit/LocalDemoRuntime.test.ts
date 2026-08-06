import type { SurveyDefinition } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { LocalDemoRuntime } from '../../src/features/demo/api/LocalDemoRuntime.js';
import { readDefinitionResult } from '../../src/features/demo/api/demoResponseSchemas.js';

const definition: SurveyDefinition = {
  pages: [
    {
      name: 'profile',
      elements: [
        { type: 'text', name: 'email', isRequired: true },
        { type: 'rating', name: 'rating', correctAnswer: 5 },
      ],
    },
  ],
};

describe('SDK demo local runtime', () => {
  test('validates and canonicalizes through the public TypeScript SDK', async () => {
    const result = await new LocalDemoRuntime().validateDefinition(definition);

    expect(result.accepted).toBe(true);
    expect(result.definition).toMatchObject({ schemaVersion: 1 });
    expect(result.diagnostics).toEqual([]);
  });

  test('submits valid answers and returns the SDK score', async () => {
    const result = await new LocalDemoRuntime().submit(definition, {
      email: 'ada@example.com',
      rating: 5,
    });

    expect(result).toMatchObject({
      runtime: 'typescript',
      accepted: true,
      completed: true,
      outcome: 'advanced',
      score: { earned: 1, possible: 1, questionCount: 1, ratio: 1 },
    });
  });

  test('demonstrates the same host rejection as the C# profile', async () => {
    const runtime = new LocalDemoRuntime();
    const errors = await runtime.validateAnswers(
      { email: 'blocked@example.com' },
      ['email'],
    );
    const result = await runtime.submit(
      definition,
      { email: 'blocked@example.com', rating: 5 },
    );

    expect(result.accepted).toBe(false);
    expect(errors).toContainEqual(expect.objectContaining({ name: 'email', kind: 'server' }));
    expect(result.errors).toContainEqual(
      expect.objectContaining({ name: 'email', kind: 'server' }),
    );
  });

  test('rejects malformed remote response data at the adapter boundary', () => {
    expect(() =>
      readDefinitionResult({ runtime: 'dotnet', accepted: true, diagnostics: 'none' }),
    ).toThrow('diagnostics must be an array');
  });
});
