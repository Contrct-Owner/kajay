import { collectEndpointDiagnostics } from '../model/endpoints.js';
import { FillInTheBlankQuestion } from '../model/FillInTheBlankQuestion.js';
import { collectBlankDiagnostics } from './blankDiagnostics.js';
import type { BlankTemplateQuestion } from './blankDiagnostics.js';
import { FileQuestion } from '../model/FileQuestion.js';
import { RepeatingQuestion } from '../model/RepeatingQuestion.js';
import { StringDictionary } from '../strings/StringDictionary.js';
import { ROW_SCOPE } from '../model/matrixCells.js';
import { SelectQuestion } from '../model/SelectQuestion.js';
import type { ChildCollectionDescriptor } from '../metadata/ClassDescriptor.js';
import { globalRegistry } from '../metadata/globalRegistry.js';
import { MetadataRegistry } from '../metadata/MetadataRegistry.js';
import { Survey } from '../model/Survey.js';
import type { SurveyOptions } from '../model/SurveyOptions.js';
import type { SurveyElement } from '../model/SurveyElement.js';
import type { Diagnostic } from './Diagnostic.js';
import { describeType, isJsonObject } from './describeType.js';
import type { ReadContext } from './ReadContext.js';
import { readProperty } from './readProperty.js';
import { CURRENT_SCHEMA_VERSION, UnsupportedSchemaVersionError } from './schemaVersion.js';
import { digestAndBindDefinition } from './definitionDigest.js';

export interface ParseResult {
  readonly survey: Survey;
  /** Content identity of the canonical definition used to create the survey. */
  readonly definitionDigest: string;
  /** Everything noteworthy about the definition. Never thrown away silently. */
  readonly diagnostics: readonly Diagnostic[];
}

const SCHEMA_VERSION_PROPERTY = 'schemaVersion';
const TYPE_PROPERTY = 'type';

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
 * What a host supplies alongside the definition.
 *
 * The survey's own options: parsing installs them, and a second type listing the same
 * seams would be two places to add the next one.
 */
export type ParseOptions = SurveyOptions;

/**
 * Reads a definition into a model.
 *
 * Structural problems (not an object, an unsupported format version) throw, because
 * there is no useful model to hand back. Everything else — unknown properties, wrong
 * value types — is reported as a diagnostic so the caller sees the whole picture at
 * once instead of one error per attempt.
 *
 * The second argument accepts either a registry or the options, because a host that
 * only wants to pass `fetchJson` should not have to name a registry it does not care
 * about. The host-demo found this the moment it needed a fetcher.
 */
export function parseSurvey(
  definition: unknown,
  registryOrOptions?: MetadataRegistry | ParseOptions,
  maybeOptions: ParseOptions = {},
): ParseResult {
  const usedRegistry = registryOrOptions instanceof MetadataRegistry;
  const registry = usedRegistry ? registryOrOptions : globalRegistry;
  const options = usedRegistry ? maybeOptions : (registryOrOptions ?? maybeOptions);

  if (!isJsonObject(definition)) {
    throw new TypeError(
      `A survey definition must be a JSON object; received ${describeType(definition)}.`,
    );
  }
  assertSupportedSchemaVersion(definition);

  const context: ReadContext = {
    registry,
    diagnostics: [],
    locale: { locale: '', strings: new StringDictionary() },
    values: options.values ?? {},
  };
  const root = readElement(definition, 'survey', '', context, [SCHEMA_VERSION_PROPERTY]);
  if (!(root instanceof Survey)) {
    throw new TypeError('The root of a definition must deserialize to a survey.');
  }
  // Everything the host supplies goes in before logic first runs: a lazily-paged
  // question asks for its first page as it is registered, and a loader arriving
  // afterwards would be too late for it. Conditions can only be registered once the
  // whole tree exists, so this runs here rather than as elements are added.
  root.configure(options);
  // The authored locale, applied before anything reads a string. Through `setLocale` so
  // there is one path a locale can arrive by, and so a definition that names one is
  // indistinguishable from a host that switched to it.
  const authored = root.getResolvedProperty('locale');
  root.setLocale(typeof authored === 'string' ? authored : '');
  // Before the first logic run, because a cell's conditions are registered as the tree
  // is walked and a matrix with no cells yet would be walked as an empty one.
  attachRepeatingCells(root, registry);
  attachFileSeams(root, options);
  root.refreshLogic();
  // After the tree exists, because it is a fact about the questions in it rather than
  // about any one property as it is read.
  context.diagnostics.push(
    ...collectEndpointDiagnostics(urlQuestions(root), options.endpoints ?? {}),
    ...collectBlankDiagnostics(blankQuestions(root, registry)),
  );
  const definitionDigest = digestAndBindDefinition(root, registry);
  return { survey: root, definitionDigest, diagnostics: context.diagnostics };
}

/**
 * Gives every repeating question the registry its instances are built from.
 *
 * Here rather than in the model because the model has no registry and must not import
 * the serialization layer to find one — the same inversion the architecture check
 * enforces everywhere else. A cell is built by copying its column, so the type it is
 * copied *into* has to come from whoever knows which registry this survey was read with.
 *
 * `refreshLogic` is what a structural change needs: the rows of a dynamic matrix appear
 * at runtime, and their cells' conditions are graph rules like any other.
 */
function attachRepeatingCells(survey: Survey, registry: MetadataRegistry): void {
  for (const question of survey.questions) {
    if (question instanceof RepeatingQuestion) {
      question.attachCells({
        registry,
        onRowsChanged: () => {
          survey.refreshLogic();
        },
        announceRecords: (event) => {
          survey.onRecordsChanged.emit(event);
        },
        evaluate: (expression, values) =>
          survey.evaluate(expression, { name: ROW_SCOPE, values }).value,
      });
    }
  }
}

/**
 * Gives every file question the host's storage seams.
 *
 * Beside the cell attachment and for the same reason: the model cannot reach for
 * `fetch`, and only the host knows where a file should go.
 */
function attachFileSeams(survey: Survey, options: SurveyOptions): void {
  for (const question of survey.questions) {
    if (question instanceof FileQuestion) {
      question.attachFileSeams(options);
      question.setFilesChangedListener((files, change) => {
        survey.onFilesChanged.emit({ question, files, change });
      });
    }
  }
}

/** Every question that loads its choices from a URL. */
function urlQuestions(survey: Survey): readonly { name: string; choicesByUrl: string }[] {
  return survey.questions
    .filter((question) => question instanceof SelectQuestion)
    .map((question) => ({ name: question.name, choicesByUrl: question.choicesByUrl }))
    .filter((question) => question.choicesByUrl.length > 0);
}

/** Every fill-in-the-blank question, as the blank diagnostics want to see one. */
function blankQuestions(
  survey: Survey,
  registry: MetadataRegistry,
): readonly BlankTemplateQuestion[] {
  return survey.questions
    .filter((question) => question instanceof FillInTheBlankQuestion)
    .map((question) => ({
      name: question.name,
      // The *authored* property, not the resolved string: every locale has to be compared,
      // and `template` has already collapsed to the one being read.
      template: question.getPropertyValue('template'),
      blanks: question.blanks.map((blank) => ({
        name: blank.name,
        type: blank.type,
        allowsInline: registry.getClass(blank.type)?.allowsInline ?? false,
      })),
    }));
}

function readElement(
  json: Record<string, unknown>,
  className: string,
  path: string,
  context: ReadContext,
  reservedKeys: readonly string[],
): SurveyElement {
  const element = context.registry.createInstance(className);
  element.setLocaleScope(context.locale);
  const properties = context.registry.getProperties(className);
  const childCollections = context.registry.getChildCollections(className);

  const handledKeys = new Set<string>([TYPE_PROPERTY, ...reservedKeys]);
  for (const collection of childCollections) {
    handledKeys.add(collection.property);
  }

  for (const [key, value] of Object.entries(json)) {
    if (handledKeys.has(key)) {
      continue;
    }
    readProperty(element, { key, value, className, path, properties }, context);
  }

  for (const collection of childCollections) {
    readChildren(json, element, collection, className, path, context);
  }
  return element;
}

function readChildren(
  json: Record<string, unknown>,
  element: SurveyElement,
  childCollection: ChildCollectionDescriptor,
  className: string,
  path: string,
  context: ReadContext,
): void {
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
    const resolved = resolveChild(
      child,
      `${collectionPath}/${index}`,
      allowedTypes,
      childCollection,
      context,
    );
    if (resolved !== undefined) {
      element.addChild(childCollection.property, resolved);
    }
  }
}

/**
 * Expands a shorthand child into its object form.
 *
 * `"a"` inside a collection declaring `shorthandProperty: 'value'` means
 * `{ value: "a" }`. Returns undefined when the collection has no shorthand, so the
 * caller can report the entry as malformed instead.
 */
function expandShorthand(
  child: unknown,
  collection: ChildCollectionDescriptor,
): Record<string, unknown> | undefined {
  const { shorthandProperty } = collection;
  if (shorthandProperty === undefined) {
    return undefined;
  }
  if (typeof child === 'string' || typeof child === 'number' || typeof child === 'boolean') {
    return { [shorthandProperty]: child };
  }
  return undefined;
}

function resolveChild(
  rawChild: unknown,
  childPath: string,
  allowedTypes: readonly string[],
  collection: ChildCollectionDescriptor,
  context: ReadContext,
): SurveyElement | undefined {
  const elementBaseType = collection.elementBaseType;
  const child = isJsonObject(rawChild) ? rawChild : expandShorthand(rawChild, collection);
  if (child === undefined) {
    context.diagnostics.push({
      severity: 'error',
      code: 'invalid-element',
      message: `Element must be an object; received ${describeType(rawChild)}.`,
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
