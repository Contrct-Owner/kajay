import type { MetadataRegistry } from '../metadata/MetadataRegistry.js';
import { globalRegistry } from '../metadata/globalRegistry.js';
import { PROPERTY_TYPES } from '../metadata/PropertyDescriptor.js';
import type { PropertyDescriptor, PropertyType, PropertyValue } from '../metadata/PropertyDescriptor.js';
import { CURRENT_SCHEMA_VERSION, SCHEMA_ID } from '../serialization/schemaVersion.js';

export const RUNTIME_METADATA_CONTRACT_VERSION: number = 1;

export interface RuntimeMetadataProperty {
  readonly name: string;
  readonly type: PropertyType;
  readonly defaultValue: PropertyValue;
  readonly isRequired: boolean;
  readonly description: string | null;
}

export interface RuntimeMetadataChildCollection {
  readonly property: string;
  readonly elementBaseType: string;
  readonly shorthandProperty: string | null;
}

export interface RuntimeMetadataClass {
  readonly name: string;
  readonly parent: string | null;
  readonly isAbstract: boolean;
  /** Properties declared by this class. Inherited properties come from `parent`. */
  readonly declaredProperties: readonly RuntimeMetadataProperty[];
  /** Child collections declared by this class. Inherited collections come from `parent`. */
  readonly declaredChildCollections: readonly RuntimeMetadataChildCollection[];
}

export interface RuntimeMetadataContract {
  readonly contractVersion: number;
  readonly definitionSchemaId: string;
  readonly definitionSchemaVersion: number;
  readonly propertyTypes: readonly PropertyType[];
  readonly classes: readonly RuntimeMetadataClass[];
}

function metadataProperty(property: PropertyDescriptor): RuntimeMetadataProperty {
  return {
    name: property.name,
    type: property.type,
    defaultValue: property.defaultValue,
    isRequired: property.isRequired,
    description: property.description ?? null,
  };
}

/**
 * Projects the registry's language-neutral metadata, deliberately excluding factories.
 *
 * A second runtime needs names, inheritance, properties, defaults and child structure;
 * it does not need a JavaScript constructor. Keeping that implementation detail out is
 * what makes this artifact a real cross-language seam rather than serialized TypeScript.
 */
export function generateMetadataContract(
  registry: MetadataRegistry = globalRegistry,
): RuntimeMetadataContract {
  return {
    contractVersion: RUNTIME_METADATA_CONTRACT_VERSION,
    definitionSchemaId: SCHEMA_ID,
    definitionSchemaVersion: CURRENT_SCHEMA_VERSION,
    propertyTypes: PROPERTY_TYPES,
    classes: registry.getClassNames().map((name) => {
      const descriptor = registry.getClass(name);
      if (descriptor === undefined) {
        throw new Error(`Cannot describe unregistered class "${name}".`);
      }
      return {
        name,
        parent: descriptor.parent ?? null,
        isAbstract: descriptor.isAbstract,
        declaredProperties: descriptor.properties.map(metadataProperty),
        declaredChildCollections: descriptor.childCollections.map((collection) => ({
          property: collection.property,
          elementBaseType: collection.elementBaseType,
          shorthandProperty: collection.shorthandProperty ?? null,
        })),
      };
    }),
  };
}
