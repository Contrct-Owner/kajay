import type { SurveyDefinition } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { TypeScriptDemoApplication } from '../../src/application/TypeScriptDemoApplication.js';

const definition: SurveyDefinition = {
  calculatedValues: [
    { name: 'profileComplete', expression: '{email} notempty', includeIntoResult: true },
  ],
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

describe('TypeScript demo application', () => {
  test('canonicalizes definitions through the public SDK', () => {
    const result = new TypeScriptDemoApplication(definition).loadDefinition();

    expect(result.accepted).toBe(true);
    expect(result.definition).toMatchObject({ schemaVersion: 1 });
    expect(result.diagnostics).toEqual([]);
  });

  test('runs lifecycle, calculations, and scoring for a submission', () => {
    const result = new TypeScriptDemoApplication(definition).submit(definition, {
      email: 'ada@example.com',
      rating: 5,
    });

    expect(result).toMatchObject({
      runtime: 'typescript',
      accepted: true,
      completed: true,
      outcome: 'advanced',
      data: { profileComplete: true },
      score: { earned: 1, possible: 1, questionCount: 1, ratio: 1 },
    });
  });

  test('runs host validation before accepting a response', () => {
    const result = new TypeScriptDemoApplication(definition).submit(definition, {
      email: 'blocked@example.com',
      rating: 5,
    });

    expect(result).toMatchObject({ accepted: false, completed: false, outcome: 'blocked' });
    expect(result.errors).toContainEqual(
      expect.objectContaining({ name: 'email', kind: 'server' }),
    );
  });

  test('returns stable diagnostics for an unusable definition', () => {
    const result = new TypeScriptDemoApplication(definition).validateDefinition({
      pages: [{ name: 'p', elements: [{ type: 'unknown', name: 'q' }] }],
    });

    expect(result.accepted).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ severity: 'error', code: 'unknown-element-type' }),
    );
  });

  test('round trips durable data through the public snapshot storage seam', () => {
    const result = new TypeScriptDemoApplication(definition).roundTripSnapshot(
      definition,
      { email: 'ada@example.com', rating: 5 },
    );

    expect(result.definitionDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(result.snapshot).toMatchObject({ formatVersion: 1, conformanceVersion: 2 });
    expect(result.restoredData).toMatchObject({ email: 'ada@example.com', rating: 5 });
  });
});
