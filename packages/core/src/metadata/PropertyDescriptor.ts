/** The property value kinds the Phase 0 registry understands. */
export type PropertyType = 'string' | 'number' | 'boolean';

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
  }
}
