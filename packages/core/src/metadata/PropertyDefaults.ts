import type { PropertyDescriptor, PropertyValue } from './PropertyDescriptor.js';

const defaultsByElement: WeakMap<object, ReadonlyMap<string, PropertyValue>> = new WeakMap();

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

/** The metadata default for an element property, when the element came from a registry. */
export function getPropertyDefault(element: object, name: string): PropertyValue | undefined {
  return defaultsByElement.get(element)?.get(name);
}
