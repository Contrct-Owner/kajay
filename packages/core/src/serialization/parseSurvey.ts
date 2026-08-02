import { globalRegistry } from '../metadata/globalRegistry.js';
import type { MetadataRegistry } from '../metadata/MetadataRegistry.js';
import { matchesPropertyType } from '../metadata/PropertyDescriptor.js';
import type { PropertyDescriptor } from '../metadata/PropertyDescriptor.js';
import { Survey } from '../model/Survey.js';
import type { SurveyElement } from '../model/SurveyElement.js';
import type { Diagnostic } from './Diagnostic.js';
import { CURRENT_SCHEMA_VERSION, UnsupportedSchemaVersionError } from './schemaVersion.js';

export interface ParseResult {
  readonly survey: Survey;
  /** Everything noteworthy about the definition. Never thrown away silently. */
  readonly diagnostics: readonly Diagnostic[];
}

const SCHEMA_VERSION_PROPERTY = 'schemaVersion';
const TYPE_PROPERTY = 'type';

interface ReadContext {
  readonly registry: MetadataRegistry;
  readonly diagnostics: Diagnostic[];
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describeType(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  return Array.isArray(value) ? 'array' : typeof value;
}

function assertSupportedSchemaVersion(definition: Record<string, unknown>): void {
  const declared = definition[SCHEMA_VERSION_PROPERTY];
  if (declared === undefined) {
    return;
  }
  if (typeof declared !== 'number' || !Number.isInteger(declared)) {
    throw new TypeError(`"${SCHEMA_VERSION_PROPERTY}" must be an integer when present.`);
  }
  if (declared !== CURRENT_SCHEMA_VERSION) {
    throw new UnsupportedSchemaVersionError(declared);
  }
}

/**
 * Reads a definition into a model.
 *
 * Structural problems (not an object, an unsupported format version) throw, because
 * there is no useful model to hand back. Everything else — unknown properties, wrong
 * value types — is reported as a diagnostic so the caller sees the whole picture at
 * once instead of one error per attempt.
 */
export function parseSurvey(
  definition: unknown,
  registry: MetadataRegistry = globalRegistry,
): ParseResult {
  if (!isJsonObject(definition)) {
    throw new TypeError(
      `A survey definition must be a JSON object; received ${describeType(definition)}.`,
    );
  }
  assertSupportedSchemaVersion(definition);

  const context: ReadContext = { registry, diagnostics: [] };
  const root = readElement(definition, 'survey', '', context, [SCHEMA_VERSION_PROPERTY]);
  if (!(root instanceof Survey)) {
    throw new TypeError('The root of a definition must deserialize to a survey.');
  }
  // Conditions can only be registered once the whole tree exists, so this runs here
  // rather than as elements are added.
  root.refreshLogic();
  return { survey: root, diagnostics: context.diagnostics };
}

function readElement(
  json: Record<string, unknown>,
  className: string,
  path: string,
  context: ReadContext,
  reservedKeys: readonly string[],
): SurveyElement {
  const element = context.registry.createInstance(className);
  const properties = context.registry.getProperties(className);
  const childCollection = context.registry.getChildCollection(className);

  const handledKeys = new Set<string>([TYPE_PROPERTY, ...reservedKeys]);
  if (childCollection !== undefined) {
    handledKeys.add(childCollection.property);
  }

  for (const [key, value] of Object.entries(json)) {
    if (handledKeys.has(key)) {
      continue;
    }
    readProperty(element, { key, value, className, path, properties }, context);
  }

  if (childCollection !== undefined) {
    readChildren(json, element, className, path, context);
  }
  return element;
}

interface PropertyReadRequest {
  readonly key: string;
  readonly value: unknown;
  readonly className: string;
  readonly path: string;
  readonly properties: readonly PropertyDescriptor[];
}

function readProperty(
  element: SurveyElement,
  request: PropertyReadRequest,
  context: ReadContext,
): void {
  const { key, value, className, path, properties } = request;
  const descriptor = properties.find((candidate) => candidate.name === key);

  if (descriptor === undefined) {
    element.setUnknownProperty(key, value);
    context.diagnostics.push({
      severity: 'warning',
      code: 'unknown-property',
      message:
        `Property "${key}" is not declared on "${className}". It is preserved ` +
        'verbatim and will round-trip unchanged.',
      path: `${path}/${key}`,
    });
    return;
  }

  if (!matchesPropertyType(value, descriptor.type)) {
    context.diagnostics.push({
      severity: 'error',
      code: 'property-type-mismatch',
      message:
        `Property "${key}" on "${className}" expects ${descriptor.type}, ` +
        `received ${describeType(value)}. The value was ignored.`,
      path: `${path}/${key}`,
    });
    return;
  }

  element.setPropertyValue(key, value);
}

function readChildren(
  json: Record<string, unknown>,
  element: SurveyElement,
  className: string,
  path: string,
  context: ReadContext,
): void {
  const childCollection = context.registry.getChildCollection(className);
  if (childCollection === undefined) {
    return;
  }
  const raw = json[childCollection.property];
  if (raw === undefined) {
    return;
  }

  const collectionPath = `${path}/${childCollection.property}`;
  if (!Array.isArray(raw)) {
    context.diagnostics.push({
      severity: 'error',
      code: 'invalid-child-collection',
      message: `"${childCollection.property}" on "${className}" must be an array; received ${describeType(raw)}.`,
      path: collectionPath,
    });
    return;
  }

  const allowedTypes = context.registry.getConcreteSubclasses(childCollection.elementBaseType);
  for (const [index, child] of raw.entries()) {
    const resolved = resolveChild(child, `${collectionPath}/${index}`, allowedTypes, childCollection.elementBaseType, context);
    if (resolved !== undefined) {
      element.addChild(resolved);
    }
  }
}

function resolveChild(
  child: unknown,
  childPath: string,
  allowedTypes: readonly string[],
  elementBaseType: string,
  context: ReadContext,
): SurveyElement | undefined {
  if (!isJsonObject(child)) {
    context.diagnostics.push({
      severity: 'error',
      code: 'invalid-element',
      message: `Element must be an object; received ${describeType(child)}.`,
      path: childPath,
    });
    return undefined;
  }

  const declaredType = child[TYPE_PROPERTY];
  const childType = typeof declaredType === 'string' ? declaredType : elementBaseType;
  if (!allowedTypes.includes(childType)) {
    context.diagnostics.push({
      severity: 'error',
      code: 'unknown-element-type',
      message:
        `"${childType}" is not a registered concrete "${elementBaseType}". ` +
        `Known types: ${allowedTypes.join(', ') || '(none)'}.`,
      path: childPath,
    });
    return undefined;
  }

  return readElement(child, childType, childPath, context, []);
}
