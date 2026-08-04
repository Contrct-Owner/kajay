import { SCHEMA_ID } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { generateDiagnosticContract } from '../../src/contract/generateDiagnosticContract.js';
import { generateMetadataContract } from '../../src/contract/generateMetadataContract.js';
import { createTestRegistry } from '../support/createTestRegistry.js';

describe('cross-language runtime metadata contract', () => {
  test('contains only language-neutral registry facts', () => {
    const contract = generateMetadataContract(createTestRegistry());
    expect(contract.definitionSchemaId).toBe(SCHEMA_ID);
    expect(contract.propertyTypes).toEqual(['string', 'number', 'boolean', 'value', 'json']);
    expect(JSON.stringify(contract)).not.toContain('create');
    const question = contract.classes.find(({ name }) => name === 'question');
    expect(
      question?.declaredProperties.find(({ name }) => name === 'requiredIf')?.isExpression,
    ).toBe(true);
  });

  test('is deterministic and orders classes by name', () => {
    const first = generateMetadataContract(createTestRegistry());
    const second = generateMetadataContract(createTestRegistry());
    expect(second).toEqual(first);
    const names = first.classes.map(({ name }) => name);
    expect(names).toEqual(names.toSorted());
  });

  test('projects custom types and properties without their factories', () => {
    const registry = createTestRegistry();
    registry.addProperty('text', { name: 'department', type: 'string' });
    registry.addClass({
      name: 'acmegauge',
      parent: 'question',
      properties: [{ name: 'maximum', type: 'number', defaultValue: 10 }],
      create: () => registry.createInstance('text'),
    });

    const contract = generateMetadataContract(registry);
    const text = contract.classes.find(({ name }) => name === 'text');
    const gauge = contract.classes.find(({ name }) => name === 'acmegauge');
    expect(text?.declaredProperties.map(({ name }) => name)).toContain('department');
    expect(gauge).toMatchObject({
      name: 'acmegauge',
      parent: 'question',
      declaredProperties: [{ name: 'maximum', defaultValue: 10 }],
    });
  });
});

describe('cross-language diagnostic contract', () => {
  test('publishes the stable code catalogs and names the extension seam', () => {
    const contract = generateDiagnosticContract();
    expect(contract.definitionDiagnostics.map(({ code }) => code)).toContain('unknown-property');
    expect(contract.expressionErrors.map(({ code }) => code)).toContain('function-failed');
    expect(contract.dependencyErrors.map(({ code }) => code)).toEqual([
      'cycle',
      'cascade-limit',
    ]);
    expect(contract.surveyErrors.extensible).toBe(true);
    expect(contract.surveyErrors.builtInKinds.map(({ kind }) => kind)).toContain('required');
  });
});
