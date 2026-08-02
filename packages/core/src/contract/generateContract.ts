import { globalRegistry } from '../metadata/globalRegistry.js';
import type { MetadataRegistry } from '../metadata/MetadataRegistry.js';
import type { PropertyDescriptor, PropertyType } from '../metadata/PropertyDescriptor.js';
import { CURRENT_SCHEMA_VERSION, SCHEMA_ID } from '../serialization/schemaVersion.js';

type JsonSchemaNode = Record<string, unknown>;

const JSON_SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema';

function jsonTypeFor(type: PropertyType): string {
  switch (type) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
  }
}

/**
 * Projects the metadata registry into the committed JSON Schema contract.
 *
 * Output is deterministic — `$defs` sorted by name, properties in registry declaration
 * order — so a diff in `contracts/survey-schema.json` always means a real registry
 * change and never key churn.
 */
export function generateContract(registry: MetadataRegistry = globalRegistry): JsonSchemaNode {
  const definitions: JsonSchemaNode = {};
  for (const className of registry.getClassNames()) {
    definitions[className] = buildClassSchema(registry, className);
  }
  return {
    $schema: JSON_SCHEMA_DIALECT,
    $id: SCHEMA_ID,
    title: 'Kajay survey definition',
    description:
      'Generated from the metadata registry. Do not edit by hand: `npm run check:contract` fails on drift.',
    $ref: '#/$defs/survey',
    $defs: definitions,
  };
}

function buildClassSchema(registry: MetadataRegistry, className: string): JsonSchemaNode {
  const descriptor = registry.getClass(className);
  if (descriptor === undefined) {
    throw new Error(`Cannot build schema for unregistered class "${className}".`);
  }

  // An abstract class contributes a union of its concrete subclasses, which is what a
  // child collection referencing it actually means.
  if (descriptor.isAbstract) {
    return {
      description: `Any concrete "${className}".`,
      oneOf: registry.getConcreteSubclasses(className).map((name) => ({ $ref: `#/$defs/${name}` })),
    };
  }

  const { properties, required } = buildProperties(registry, className);
  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
    // Unknown properties are preserved by the parser and reported as diagnostics, so
    // the contract must not reject them (checklist A1).
    additionalProperties: true,
  };
}

interface BuiltProperties {
  readonly properties: JsonSchemaNode;
  readonly required: string[];
}

function buildProperties(registry: MetadataRegistry, className: string): BuiltProperties {
  const properties: JsonSchemaNode = {};
  const required: string[] = [];

  if (className === 'survey') {
    properties['schemaVersion'] = {
      type: 'integer',
      enum: [CURRENT_SCHEMA_VERSION],
      description:
        'Format version. Absent means current; an unknown value is refused, not guessed.',
    };
  }

  // Only a class reachable through an abstract base needs to say which one it is;
  // elsewhere the collection's declared element type already implies it.
  properties['type'] = { const: className };
  if (hasAbstractAncestor(registry, className)) {
    required.push('type');
  } else if (className === 'survey') {
    delete properties['type'];
  }

  for (const property of registry.getProperties(className)) {
    properties[property.name] = buildPropertySchema(property);
    if (property.isRequired) {
      required.push(property.name);
    }
  }

  for (const collection of registry.getChildCollections(className)) {
    properties[collection.property] = {
      type: 'array',
      items: { $ref: `#/$defs/${collection.elementBaseType}` },
    };
  }

  return { properties, required };
}

function buildPropertySchema(property: PropertyDescriptor): JsonSchemaNode {
  const node: JsonSchemaNode = {
    type: jsonTypeFor(property.type),
    default: property.defaultValue,
  };
  if (property.description !== undefined) {
    node['description'] = property.description;
  }
  return node;
}

function hasAbstractAncestor(registry: MetadataRegistry, className: string): boolean {
  let parent = registry.getClass(className)?.parent;
  while (parent !== undefined) {
    const descriptor = registry.getClass(parent);
    if (descriptor?.isAbstract === true) {
      return true;
    }
    parent = descriptor?.parent;
  }
  return false;
}
