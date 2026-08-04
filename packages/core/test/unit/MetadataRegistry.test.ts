import {
  MetadataRegistry,
  type PropertyValue,
  SurveyElement,
  TextQuestion,
  globalRegistry,
} from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { BUILT_IN_TYPE_DEFINITIONS } from '../../src/metadata/builtInTypeDefinitions.js';
import { createTestRegistry } from '../support/createTestRegistry.js';

class DefaultedElement extends SurveyElement {
  override get type(): string {
    return 'defaulted';
  }

  get label(): string {
    return this.getStringProperty('label');
  }
}

function getFalsyOverride(value: PropertyValue): PropertyValue | undefined {
  if (typeof value === 'string') {
    return value.length === 0 ? undefined : '';
  }
  if (typeof value === 'number') {
    return value === 0 ? undefined : 0;
  }
  if (typeof value === 'boolean') {
    return value ? false : undefined;
  }
  return undefined;
}

describe('parity/A3-metadata-registry', () => {
  test('resolves inherited properties ancestors-first in declaration order', () => {
    const registry = createTestRegistry();
    const inherited = registry.getProperties('question').map((property) => property.name);
    const names = registry.getProperties('text').map((property) => property.name);

    // Stated as the invariant rather than a literal list: every property added to the
    // base would otherwise break this test without telling us anything new.
    expect(names.slice(0, inherited.length)).toEqual(inherited);
    expect(names.slice(inherited.length)).toEqual([
      'inputType',
      'placeholder',
      'min',
      'max',
      'step',
    ]);
  });

  test('a subclass redeclaring an inherited property replaces it in place', () => {
    const registry = createTestRegistry();
    registry.addClass({
      name: 'test-override',
      parent: 'question',
      properties: [{ name: 'title', type: 'string', defaultValue: 'overridden' }],
      create: () => registry.createInstance('text'),
    });

    const inherited = registry.getProperties('question').map((property) => property.name);
    const properties = registry.getProperties('test-override');

    // Same names in the same order: redeclaring adds nothing and moves nothing.
    expect(properties.map((property) => property.name)).toEqual(inherited);
    // And `title` keeps its inherited position rather than moving to the end.
    expect(properties[inherited.indexOf('title')]?.defaultValue).toBe('overridden');
  });

  test('normalizes omitted defaults per declared type', () => {
    const registry = new MetadataRegistry();
    registry.addClass({
      name: 'sample',
      properties: [
        { name: 'label', type: 'string' },
        { name: 'count', type: 'number' },
        { name: 'enabled', type: 'boolean' },
      ],
    });
    expect(registry.getProperties('sample').map((property) => property.defaultValue)).toEqual([
      '',
      0,
      false,
    ]);
  });

  test('model access resolves the default owned by its metadata descriptor', () => {
    const registry = new MetadataRegistry();
    registry.addClass({
      name: 'defaulted',
      properties: [{ name: 'label', type: 'string', defaultValue: 'From metadata' }],
      create: () => new DefaultedElement(),
    });

    const element = registry.createInstance('defaulted') as DefaultedElement;

    expect(element.getPropertyValue('label')).toBeUndefined();
    expect(element.label).toBe('From metadata');
  });

  test('direct constructors resolve every inherited and own built-in default', () => {
    const registry = createTestRegistry();

    expect(registry.getClassNames()).toEqual(
      BUILT_IN_TYPE_DEFINITIONS.map((definition) => definition.name).toSorted(),
    );

    for (const definition of BUILT_IN_TYPE_DEFINITIONS) {
      const descriptor = registry.getClass(definition.name);
      if (descriptor?.create === undefined) {
        continue;
      }

      const direct = descriptor.create();
      const registered = registry.createInstance(definition.name);
      for (const property of registry.getProperties(definition.name)) {
        expect(direct.getResolvedProperty(property.name)).toEqual(property.defaultValue);
        expect(registered.getResolvedProperty(property.name)).toEqual(property.defaultValue);
      }
    }
  });

  test('explicit falsy values override every non-falsy built-in default', () => {
    const registry = createTestRegistry();
    let overridesProved = 0;

    for (const definition of BUILT_IN_TYPE_DEFINITIONS) {
      const create = registry.getClass(definition.name)?.create;
      if (create === undefined) {
        continue;
      }

      const direct = create();
      for (const property of registry.getProperties(definition.name)) {
        const override = getFalsyOverride(property.defaultValue);
        if (override === undefined) {
          continue;
        }
        direct.setPropertyValue(property.name, override);
        expect(direct.hasPropertyValue(property.name)).toBe(true);
        expect(direct.getResolvedProperty(property.name)).toEqual(override);
        overridesProved += 1;
      }
    }

    expect(overridesProved).toBeGreaterThan(0);
  });

  test('a creating registry overrides the built-in fallback for the same class name', () => {
    const registry = new MetadataRegistry();
    registry.addClass({
      name: 'text',
      properties: [{ name: 'inputType', type: 'string', defaultValue: 'email' }],
      create: () => new TextQuestion(),
    });

    const text = registry.createInstance('text') as TextQuestion;
    expect(text.inputType).toBe('email');
  });

  test('addProperty injects into an existing class', () => {
    const registry = createTestRegistry();
    registry.addProperty('text', { name: 'department', type: 'string' });
    expect(registry.getProperties('text').map((property) => property.name)).toContain('department');
  });

  test('rejects duplicate class and property registration', () => {
    const registry = createTestRegistry();
    expect(() => registry.addClass({ name: 'text' })).toThrow(/already registered/u);
    expect(() => registry.addProperty('text', { name: 'inputType', type: 'string' })).toThrow(
      /already declares/u,
    );
  });

  test('rejects a class whose declared parent is unregistered', () => {
    const registry = new MetadataRegistry();
    expect(() => registry.addClass({ name: 'orphan', parent: 'nope' })).toThrow(/not registered/u);
  });

  test('getConcreteSubclasses omits abstract classes', () => {
    const registry = createTestRegistry();
    const concrete = registry.getConcreteSubclasses('question');

    expect(concrete).toContain('text');
    // The point of the rule, stated directly: bases are excluded however many
    // concrete types get added beneath them.
    expect(concrete).not.toContain('question');
    expect(concrete).not.toContain('selectbase');
  });

  test('refuses to instantiate an abstract class', () => {
    const registry = createTestRegistry();
    expect(() => registry.createInstance('question')).toThrow(/abstract or has no factory/u);
    expect(() => registry.createInstance('nope')).toThrow(/no such registered class/u);
  });

  test('registering against the global registry is reversible', () => {
    // Unique name plus teardown: the rule for touching process-global state.
    const uniqueType = `test-cleanup-${Math.random().toString(36).slice(2)}`;
    try {
      globalRegistry.addClass({ name: uniqueType, parent: 'question' });
      expect(globalRegistry.hasClass(uniqueType)).toBe(true);
    } finally {
      globalRegistry.removeClass(uniqueType);
    }
    expect(globalRegistry.hasClass(uniqueType)).toBe(false);
  });
});
