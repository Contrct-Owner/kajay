import { parseSurvey, serializeSurvey } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

/** Every fixture in the corpus is held to all three rules of ADR-0002. */
const fixtures: Readonly<Record<string, SurveyDefinition>> = {
  minimal: {
    pages: [{ name: 'p1', elements: [{ type: 'text', name: 'q1' }] }],
  },
  titled: {
    title: 'Survey',
    description: 'Description',
    pages: [
      {
        name: 'p1',
        title: 'Page one',
        elements: [
          { type: 'text', name: 'q1', title: 'Name', isRequired: true, placeholder: 'Ada' },
          { type: 'text', name: 'q2', inputType: 'email' },
        ],
      },
    ],
  },
  withExplicitDefaults: {
    title: '',
    pages: [
      {
        name: 'p1',
        title: '',
        elements: [{ type: 'text', name: 'q1', isRequired: false, inputType: 'text' }],
      },
    ],
  },
  withUnknownProperties: {
    pages: [
      {
        name: 'p1',
        department: 'engineering',
        elements: [{ type: 'text', name: 'q1', nested: { keep: [1, 2, 3] } }],
      },
    ],
  },
  multiPage: {
    pages: [
      { name: 'p1', elements: [{ type: 'text', name: 'q1' }] },
      { name: 'p2', elements: [{ type: 'text', name: 'q2' }] },
    ],
  },
  // A second child collection on a question, which is what `validators` introduced.
  // Nothing else in the corpus proves a question can hold two kinds of child and write
  // both back in the order the registry declares them.
  withValidators: {
    validationEnabled: false,
    checkErrorsMode: 'onValueChanged',
    questionErrorLocation: 'bottom',
    pages: [
      {
        name: 'p1',
        elements: [
          {
            type: 'text',
            name: 'q1',
            isRequired: true,
            requiredErrorText: 'We need this.',
            validators: [
              { type: 'textvalidator', minLength: 2, maxLength: 8, allowDigits: false },
              { type: 'regexvalidator', regex: '^[A-Z]', text: 'Start with a capital.' },
            ],
          },
          {
            type: 'checkbox',
            name: 'q2',
            choices: ['a', 'b'],
            validators: [{ type: 'answercountvalidator', minCount: 1 }],
          },
        ],
      },
    ],
  },
};

function pagesOf(definition: SurveyDefinition): SurveyDefinition[] {
  return (definition['pages'] ?? []) as SurveyDefinition[];
}

function elementsOf(page: SurveyDefinition | undefined): SurveyDefinition[] {
  return (page?.['elements'] ?? []) as SurveyDefinition[];
}

function fixture(name: keyof typeof fixtures): SurveyDefinition {
  const definition = fixtures[name];
  if (definition === undefined) {
    throw new Error(`Unknown fixture "${String(name)}".`);
  }
  return definition;
}

describe.each(Object.entries(fixtures))('parity/A2-round-trip: %s', (_name, definition) => {
  test('the model is stable across a serialize/parse cycle', () => {
    const registry = createTestRegistry();
    const first = parseSurvey(definition, registry);
    const canonical = serializeSurvey(first.survey, registry);
    const second = parseSurvey(canonical, registry);
    expect(serializeSurvey(second.survey, registry)).toEqual(canonical);
  });

  test('serialization reaches a byte-identical fixed point on the second pass', () => {
    const registry = createTestRegistry();
    const once = JSON.stringify(serializeSurvey(parseSurvey(definition, registry).survey, registry));
    const twice = JSON.stringify(
      serializeSurvey(parseSurvey(JSON.parse(once), registry).survey, registry),
    );
    expect(twice).toBe(once);
  });
});

describe('canonical form', () => {
  test('elides properties equal to their registry default', () => {
    const registry = createTestRegistry();
    const canonical = serializeSurvey(
      parseSurvey(fixture('withExplicitDefaults'), registry).survey,
      registry,
    );
    expect(elementsOf(pagesOf(canonical)[0])[0]).toEqual({ type: 'text', name: 'q1' });
    expect(canonical['title']).toBeUndefined();
  });

  test('always emits required properties, even at their default', () => {
    const registry = createTestRegistry();
    const canonical = serializeSurvey(
      parseSurvey({ pages: [{ name: '' }] }, registry).survey,
      registry,
    );
    expect(pagesOf(canonical)[0]).toEqual({ name: '' });
  });

  test('emits schemaVersion and orders keys type, properties, children, unknowns', () => {
    const registry = createTestRegistry();
    const canonical = serializeSurvey(
      parseSurvey(fixture('withUnknownProperties'), registry).survey,
      registry,
    );
    expect(Object.keys(canonical)).toEqual(['schemaVersion', 'pages']);
    expect(Object.keys(pagesOf(canonical)[0] ?? {})).toEqual(['name', 'elements', 'department']);
  });

  test('omits the type discriminator where position implies it', () => {
    const registry = createTestRegistry();
    const canonical = serializeSurvey(parseSurvey(fixture('minimal'), registry).survey, registry);
    expect(canonical['type']).toBeUndefined();
    expect(pagesOf(canonical)[0]?.['type']).toBeUndefined();
    expect(elementsOf(pagesOf(canonical)[0])[0]?.['type']).toBe('text');
  });

  test('preserves unknown property values verbatim, including nested structures', () => {
    const registry = createTestRegistry();
    const canonical = serializeSurvey(
      parseSurvey(fixture('withUnknownProperties'), registry).survey,
      registry,
    );
    expect(elementsOf(pagesOf(canonical)[0])[0]?.['nested']).toEqual({ keep: [1, 2, 3] });
  });
});
