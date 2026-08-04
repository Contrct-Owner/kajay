import type { ClassMetadataDefinition } from './ClassDescriptor.js';
import { BUILT_IN_TYPE_DEFINITIONS } from './builtInTypeDefinitions.js';
import type { PropertyDescriptor, PropertyValue } from './PropertyDescriptor.js';
import { normalizePropertyDefinition } from './PropertyDescriptor.js';

const defaultsByElement: WeakMap<object, ReadonlyMap<string, PropertyValue>> = new WeakMap();
const builtInDefinitionsByName: ReadonlyMap<string, ClassMetadataDefinition> = new Map(
  BUILT_IN_TYPE_DEFINITIONS.map((definition) => [definition.name, definition]),
);

/** Attaches the resolved descriptor defaults that apply to one model element. */
export function attachPropertyDefaults(
  element: object,
  descriptors: readonly PropertyDescriptor[],
): void {
  defaultsByElement.set(
    element,
    new Map(descriptors.map((descriptor) => [descriptor.name, descriptor.defaultValue])),
  );
}

/**
 * Resolves a metadata default for any model instance.
 *
 * A creating registry is authoritative when present. Directly constructed built-ins
 * fall back to the same model-free definitions that registerBuiltInTypes consumes.
 */
export function getPropertyDefault(
  element: object,
  className: string,
  propertyName: string,
): PropertyValue | undefined {
  const attached = defaultsByElement.get(element);
  if (attached !== undefined) {
    return attached.get(propertyName);
  }
  return getBuiltInPropertyDefault(className, propertyName);
}

function getBuiltInPropertyDefault(
  className: string,
  propertyName: string,
): PropertyValue | undefined {
  let current = builtInDefinitionsByName.get(className);
  while (current !== undefined) {
    const property = current.properties?.find((candidate) => candidate.name === propertyName);
    if (property !== undefined) {
      return normalizePropertyDefinition(property).defaultValue;
    }
    const parent = current.parent;
    current =
      parent === undefined
        ? undefined
        : builtInDefinitionsByName.get(parent);
  }
  return undefined;
}
