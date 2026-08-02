import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';

/**
 * A private registry carrying the built-in types.
 *
 * Tests use this instead of `globalRegistry` wherever they can: the global registry is
 * process-wide shared mutable state, and the suite must stay safe to parallelise.
 */
export function createTestRegistry(): MetadataRegistry {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return registry;
}
