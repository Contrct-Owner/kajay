import type { MetadataRegistry } from './MetadataRegistry.js';
import { BUILT_IN_TYPE_DEFINITIONS } from './builtInTypeDefinitions.js';
import { BUILT_IN_TYPE_FACTORIES } from './builtInTypeFactories.js';

/**
 * Registers the built-in type set.
 *
 * Metadata order is the inheritance-safe order. Factories are joined here, at the
 * registry seam, so the authoritative definitions remain model-free.
 */
export function registerBuiltInTypes(registry: MetadataRegistry): void {
  for (const definition of BUILT_IN_TYPE_DEFINITIONS) {
    const create = BUILT_IN_TYPE_FACTORIES[definition.name];
    if (!(definition.isAbstract ?? false) && create === undefined) {
      throw new Error(`Built-in class "${definition.name}" has no model factory.`);
    }
    registry.addClass(create === undefined ? definition : { ...definition, create });
  }
}
