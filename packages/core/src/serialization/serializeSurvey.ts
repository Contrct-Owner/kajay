import { globalRegistry } from '../metadata/globalRegistry.js';
import type { MetadataRegistry } from '../metadata/MetadataRegistry.js';
import type { Survey } from '../model/Survey.js';
import type { SurveyElement } from '../model/SurveyElement.js';
import { CURRENT_SCHEMA_VERSION } from './schemaVersion.js';

/** A serialized definition: plain JSON, safe to `JSON.stringify`. */
export type SurveyDefinition = Record<string, unknown>;

/**
 * Writes the canonical form of a model (ADR-0002).
 *
 * Canonical means, in order: `schemaVersion`, then `type` when it is not implied by
 * position, then declared properties in registry declaration order, then the child
 * collection, then any preserved unknown properties. Properties equal to their
 * registry default are elided unless the property is required.
 *
 * Eliding defaults is exactly why the round-trip bar is a fixed point rather than byte
 * stability: a definition that writes a default explicitly loses it on the first pass,
 * and is byte-identical from the second pass onward.
 */
export function serializeSurvey(
  survey: Survey,
  registry: MetadataRegistry = globalRegistry,
): SurveyDefinition {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    ...serializeElement(survey, registry, survey.type),
  };
}

function serializeElement(
  element: SurveyElement,
  registry: MetadataRegistry,
  impliedType: string,
): SurveyDefinition {
  const output: SurveyDefinition = {};

  if (element.type !== impliedType) {
    output['type'] = element.type;
  }

  for (const descriptor of registry.getProperties(element.type)) {
    const value = element.getPropertyValue(descriptor.name);
    if (descriptor.isRequired) {
      output[descriptor.name] = value ?? descriptor.defaultValue;
      continue;
    }
    if (value === undefined || value === descriptor.defaultValue) {
      continue;
    }
    output[descriptor.name] = value;
  }

  // Collections serialize in declaration order, and an empty one is omitted entirely.
  for (const collection of registry.getChildCollections(element.type)) {
    const children = element.getChildren(collection.property);
    if (children.length > 0) {
      output[collection.property] = children.map((child) =>
        serializeElement(child, registry, collection.elementBaseType),
      );
    }
  }

  for (const [name, value] of element.getUnknownProperties()) {
    output[name] = value;
  }

  return output;
}
