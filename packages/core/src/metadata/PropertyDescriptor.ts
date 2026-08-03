/**
 * The property value kinds the registry understands.
 *
 * `value` is a literal of whichever scalar type the author wrote — a setvalue trigger
 * stores `42`, `'yes'` or `true` in the same property, and forcing it to one of them
 * would make the definition lie about what the trigger does.
 */
export const PROPERTY_TYPES = ['string', 'number', 'boolean', 'value'] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

/** Every value a declared property can hold. */
export type PropertyValue = string | number | boolean;

/**
 * Input form of a property: what a registration supplies. Optional fields are
 * resolved once, at registration, so nothing downstream has to guess.
 */
export interface PropertyDefinition {
  readonly name: string;
  readonly type: PropertyType;
  readonly defaultValue?: PropertyValue;
  /** Required properties are always emitted, even when they equal the default. */
  readonly isRequired?: boolean;
  readonly description?: string;
}

/** Stored form: fully resolved. The serializer and schema generator read only this. */
export interface PropertyDescriptor {
  readonly name: string;
  readonly type: PropertyType;
  readonly defaultValue: PropertyValue;
  readonly isRequired: boolean;
  readonly description: string | undefined;
}

function defaultForType(type: PropertyType): PropertyValue {
  switch (type) {
    case 'string':
    case 'value':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
  }
}

export function normalizePropertyDefinition(definition: PropertyDefinition): PropertyDescriptor {
  return {
    name: definition.name,
    type: definition.type,
    defaultValue: definition.defaultValue ?? defaultForType(definition.type),
    isRequired: definition.isRequired ?? false,
    description: definition.description,
  };
}

/** True when `value` is assignable to a property of `type`. */
export function matchesPropertyType(value: unknown, type: PropertyType): value is PropertyValue {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'value':
      return (
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value))
      );
  }
}
