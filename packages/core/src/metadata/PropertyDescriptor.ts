/**
 * The property value kinds the registry understands.
 *
 * `value` is a literal of whichever scalar type the author wrote — a setvalue trigger
 * stores `42`, `'yes'` or `true` in the same property, and forcing it to one of them
 * would make the definition lie about what the trigger does.
 *
 * `json` is a structure we deliberately do not interpret: a dynamic matrix's
 * `defaultRowValue` is an object keyed by column, and there is nothing useful to say
 * about its shape from here. It is kept and round-tripped verbatim. Distinct from
 * `value` rather than a widening of it, because everything reading a `value` property
 * treats it as a scalar and would have to start asking.
 */
export const PROPERTY_TYPES = ['string', 'number', 'boolean', 'value', 'json'] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

/** Every value a declared property can hold. */
export type PropertyValue =
  | string
  | number
  | boolean
  | readonly unknown[]
  | Readonly<Record<string, unknown>>;

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
  /**
   * Whether the property holds an expression in the survey's own language.
   *
   * Declared here because more than one thing needs to know, and a list kept elsewhere
   * would be wrong the day a property arrived: a matrix cell rewrites `{row.price}` into
   * a real path in *every* expression its column carries, and the Creator's logic editor
   * (§M) has to know which fields it may open.
   */
  readonly isExpression?: boolean;
  readonly description?: string;
}

/** Stored form: fully resolved. The serializer and schema generator read only this. */
export interface PropertyDescriptor {
  readonly name: string;
  readonly type: PropertyType;
  readonly defaultValue: PropertyValue;
  readonly isRequired: boolean;
  readonly isExpression: boolean;
  readonly description: string | undefined;
}

function defaultForType(type: PropertyType): PropertyValue {
  switch (type) {
    // `json` joins them: a structure has no useful neutral value, and the empty string
    // is what every reader of one already treats as "nothing was authored".
    case 'string':
    case 'value':
    case 'json':
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
    isExpression: definition.isExpression ?? false,
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
    case 'json':
      // Anything a definition can hold. `undefined` is not JSON and is how an absent
      // property is spelled, so it is the one thing refused.
      return value !== undefined;
  }
}
