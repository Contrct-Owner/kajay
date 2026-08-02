import { MetadataRegistry, globalRegistry } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

describe('parity/A3-metadata-registry', () => {
  test('resolves inherited properties ancestors-first in declaration order', () => {
    const registry = createTestRegistry();
    const inherited = registry.getProperties('question').map((property) => property.name);
    const names = registry.getProperties('text').map((property) => property.name);

    // Stated as the invariant rather than a literal list: every property added to the
    // base would otherwise break this test without telling us anything new.
    expect(names.slice(0, inherited.length)).toEqual(inherited);
    expect(names.slice(inherited.length)).toEqual(['inputType', 'placeholder']);
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
    expect(registry.getConcreteSubclasses('question')).toEqual(['text']);
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
