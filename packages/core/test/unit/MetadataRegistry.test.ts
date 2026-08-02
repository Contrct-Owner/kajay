import { MetadataRegistry, globalRegistry } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

describe('parity/A3-metadata-registry', () => {
  test('resolves inherited properties ancestors-first in declaration order', () => {
    const registry = createTestRegistry();
    const names = registry.getProperties('text').map((property) => property.name);
    expect(names).toEqual(['name', 'title', 'isRequired', 'inputType', 'placeholder']);
  });

  test('a subclass redeclaring an inherited property replaces it in place', () => {
    const registry = createTestRegistry();
    registry.addClass({
      name: 'test-override',
      parent: 'question',
      properties: [{ name: 'title', type: 'string', defaultValue: 'overridden' }],
      create: () => registry.createInstance('text'),
    });

    const properties = registry.getProperties('test-override');
    expect(properties.map((property) => property.name)).toEqual(['name', 'title', 'isRequired']);
    expect(properties[1]?.defaultValue).toBe('overridden');
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
