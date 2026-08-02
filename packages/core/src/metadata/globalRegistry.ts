import { MetadataRegistry } from './MetadataRegistry.js';
import { registerBuiltInTypes } from './registerBuiltInTypes.js';

function createGlobalRegistry(): MetadataRegistry {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return registry;
}

/**
 * The process-global registry, pre-loaded with the built-in types.
 *
 * Built-ins are registered inside this module rather than by a bare side-effect
 * import, so `sideEffects: false` in package.json stays honest: a bundler that keeps
 * this binding necessarily keeps the registrations attached to it.
 *
 * It is global by design, which makes it shared mutable state across a test run —
 * tests that register types must use unique names and remove them in teardown, or
 * build their own `new MetadataRegistry()` instead.
 */
export const globalRegistry: MetadataRegistry = createGlobalRegistry();
