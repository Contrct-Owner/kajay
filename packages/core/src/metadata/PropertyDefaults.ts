import type { ClassMetadataDefinition } from './ClassDescriptor.js';
import { CORE_TYPE_DEFINITIONS } from './coreTypeDefinitions.js';
import { DISPLAY_TYPE_DEFINITIONS } from './displayTypeDefinitions.js';
import type { PropertyDescriptor, PropertyValue } from './PropertyDescriptor.js';
import { normalizePropertyDefinition } from './PropertyDescriptor.js';
import { QUESTION_TYPE_DEFINITIONS } from './questionTypeDefinitions.js';
import { SELECT_TYPE_DEFINITIONS } from './selectTypeDefinitions.js';
import { TRIGGER_TYPE_DEFINITIONS } from './triggerTypeDefinitions.js';
import { VALIDATOR_TYPE_DEFINITIONS } from './validatorTypeDefinitions.js';

const defaultsByElement: WeakMap<object, ReadonlyMap<string, PropertyValue>> = new WeakMap();
const BUILT_IN_CLASS_DEFINITIONS: readonly ClassMetadataDefinition[] = [
  ...Object.values(CORE_TYPE_DEFINITIONS),
  ...Object.values(DISPLAY_TYPE_DEFINITIONS),
  ...Object.values(QUESTION_TYPE_DEFINITIONS),
  ...Object.values(SELECT_TYPE_DEFINITIONS),
  ...Object.values(TRIGGER_TYPE_DEFINITIONS),
  ...Object.values(VALIDATOR_TYPE_DEFINITIONS),
];

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
  let current = BUILT_IN_CLASS_DEFINITIONS.find((definition) => definition.name === className);
  while (current !== undefined) {
    const property = current.properties?.find((candidate) => candidate.name === propertyName);
    if (property !== undefined) {
      return normalizePropertyDefinition(property).defaultValue;
    }
    const parent = current.parent;
    current =
      parent === undefined
        ? undefined
        : BUILT_IN_CLASS_DEFINITIONS.find((definition) => definition.name === parent);
  }
  return undefined;
}
