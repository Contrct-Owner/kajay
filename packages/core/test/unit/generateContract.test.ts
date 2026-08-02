import { SCHEMA_ID, generateContract } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

describe('parity/A6-contract-generated-from-registry', () => {
  test('carries the URN identifier and the 2020-12 dialect', () => {
    const contract = generateContract(createTestRegistry());
    expect(contract['$id']).toBe(SCHEMA_ID);
    expect(contract['$schema']).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(contract['$ref']).toBe('#/$defs/survey');
  });

  test('is deterministic, so a diff always means a registry change', () => {
    const first = JSON.stringify(generateContract(createTestRegistry()));
    const second = JSON.stringify(generateContract(createTestRegistry()));
    expect(second).toBe(first);
  });

  test('sorts definitions by name', () => {
    const contract = generateContract(createTestRegistry());
    const names = Object.keys(contract['$defs'] as Record<string, unknown>);
    expect(names).toEqual(names.toSorted());
  });

  test('projects an abstract class as a union of its concrete subclasses', () => {
    const contract = generateContract(createTestRegistry());
    const definitions = contract['$defs'] as Record<string, Record<string, unknown>>;
    expect(definitions['question']?.['oneOf']).toEqual([{ $ref: '#/$defs/text' }]);
  });

  test('requires the type discriminator only where an abstract ancestor exists', () => {
    const contract = generateContract(createTestRegistry());
    const definitions = contract['$defs'] as Record<string, Record<string, unknown>>;
    expect(definitions['text']?.['required']).toContain('type');
    expect(definitions['page']?.['required'] ?? []).not.toContain('type');
  });

  test('permits additional properties, because the parser preserves them', () => {
    const contract = generateContract(createTestRegistry());
    const definitions = contract['$defs'] as Record<string, Record<string, unknown>>;
    for (const [name, definition] of Object.entries(definitions)) {
      if (name === 'question') {
        continue;
      }
      expect(definition['additionalProperties'], `${name} must accept unknown properties`).toBe(
        true,
      );
    }
  });

  test('picks up a property injected through addProperty', () => {
    const registry = createTestRegistry();
    registry.addProperty('text', { name: 'department', type: 'string' });
    const definitions = generateContract(registry)['$defs'] as Record<
      string,
      Record<string, unknown>
    >;
    const properties = definitions['text']?.['properties'] as Record<string, unknown>;
    expect(properties['department']).toEqual({ type: 'string', default: '' });
  });

  test('picks up a whole custom question type', () => {
    const registry = createTestRegistry();
    registry.addClass({
      name: 'rating',
      parent: 'question',
      properties: [{ name: 'rateMax', type: 'number', defaultValue: 5 }],
      create: () => registry.createInstance('text'),
    });
    const contract = generateContract(registry);
    const definitions = contract['$defs'] as Record<string, Record<string, unknown>>;
    expect(definitions['rating']).toBeDefined();
    expect(definitions['question']?.['oneOf']).toEqual([
      { $ref: '#/$defs/rating' },
      { $ref: '#/$defs/text' },
    ]);
  });
});
