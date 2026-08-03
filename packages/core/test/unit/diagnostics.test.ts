import { CURRENT_SCHEMA_VERSION, UnsupportedSchemaVersionError, parseSurvey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

describe('parity/A1-unknown-properties-surfaced', () => {
  test('surfaces an unknown property instead of dropping it silently', () => {
    const registry = createTestRegistry();
    const { survey, diagnostics } = parseSurvey(
      { pages: [{ name: 'p1', elements: [{ type: 'text', name: 'q1', department: 'eng' }] }] },
      registry,
    );

    const unknown = diagnostics.filter((diagnostic) => diagnostic.code === 'unknown-property');
    expect(unknown).toHaveLength(1);
    expect(unknown[0]?.severity).toBe('warning');
    expect(unknown[0]?.path).toBe('/pages/0/elements/0/department');
    expect(survey.questions[0]?.getUnknownProperties().get('department')).toBe('eng');
  });

  test('reports a value whose type does not match the descriptor, and ignores it', () => {
    const registry = createTestRegistry();
    const { survey, diagnostics } = parseSurvey(
      { pages: [{ name: 'p1', elements: [{ type: 'text', name: 'q1', isRequired: 'yes' }] }] },
      registry,
    );

    const mismatch = diagnostics.find((diagnostic) => diagnostic.code === 'property-type-mismatch');
    expect(mismatch?.severity).toBe('error');
    expect(mismatch?.message).toMatch(/expects boolean, received string/u);
    expect(survey.questions[0]?.isRequired).toBe(false);
  });

  test('reports an unregistered element type', () => {
    const registry = createTestRegistry();
    const { diagnostics } = parseSurvey(
      // A name no built-in will ever claim. `rating` used to stand here and became a
      // real type, which turned this into a test of nothing.
      { pages: [{ name: 'p1', elements: [{ type: 'acmegauge', name: 'q1' }] }] },
      registry,
    );
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain('unknown-element-type');
  });

  test('reports a child collection that is not an array', () => {
    const registry = createTestRegistry();
    const { diagnostics } = parseSurvey({ pages: 'nope' }, registry);
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain('invalid-child-collection');
  });

  test('a clean definition produces no diagnostics', () => {
    const registry = createTestRegistry();
    const { diagnostics } = parseSurvey(
      { pages: [{ name: 'p1', elements: [{ type: 'text', name: 'q1' }] }] },
      registry,
    );
    expect(diagnostics).toEqual([]);
  });
});

describe('schemaVersion', () => {
  test('accepts a definition that omits it', () => {
    const registry = createTestRegistry();
    expect(() => parseSurvey({ pages: [] }, registry)).not.toThrow();
  });

  test('accepts the current version', () => {
    const registry = createTestRegistry();
    expect(() =>
      parseSurvey({ schemaVersion: CURRENT_SCHEMA_VERSION, pages: [] }, registry),
    ).not.toThrow();
  });

  test('refuses a newer version rather than parsing best-effort', () => {
    const registry = createTestRegistry();
    expect(() => parseSurvey({ schemaVersion: 99, pages: [] }, registry)).toThrow(
      UnsupportedSchemaVersionError,
    );
    try {
      parseSurvey({ schemaVersion: 99, pages: [] }, registry);
    } catch (error) {
      expect(error).toBeInstanceOf(UnsupportedSchemaVersionError);
      expect((error as UnsupportedSchemaVersionError).found).toBe(99);
      expect((error as UnsupportedSchemaVersionError).supported).toBe(CURRENT_SCHEMA_VERSION);
    }
  });

  test('rejects a non-integer version', () => {
    const registry = createTestRegistry();
    expect(() => parseSurvey({ schemaVersion: '1', pages: [] }, registry)).toThrow(TypeError);
  });

  test('does not treat schemaVersion as an unknown property', () => {
    const registry = createTestRegistry();
    const { diagnostics } = parseSurvey({ schemaVersion: 1, pages: [] }, registry);
    expect(diagnostics).toEqual([]);
  });

  test('rejects a definition that is not an object', () => {
    const registry = createTestRegistry();
    expect(() => parseSurvey([], registry)).toThrow(TypeError);
    expect(() => parseSurvey(null, registry)).toThrow(TypeError);
  });
});
