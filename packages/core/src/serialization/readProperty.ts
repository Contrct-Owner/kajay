import { matchesPropertyType, type PropertyDescriptor } from '../metadata/PropertyDescriptor.js';
import { isLocalizedText } from '../model/localizedText.js';
import type { SurveyElement } from '../model/SurveyElement.js';
import { describeType } from './describeType.js';
import { collectPropertyDiagnostics } from './propertyDiagnostics.js';
import type { ReadContext } from './ReadContext.js';

/**
 * Keeps a property the registry has never heard of, and says so — checklist A1.
 *
 * Kept rather than dropped because a definition may legitimately carry a property this
 * build does not know: one authored against a newer registry, or a host's own extension.
 * Dropping it would make the round trip lossy and lose data nobody agreed to discard.
 */
function preserveUnknownProperty(
  element: SurveyElement,
  request: PropertyReadRequest,
  context: ReadContext,
): void {
  const { key, value, className, path } = request;
  element.setUnknownProperty(key, value);
  context.diagnostics.push({
    severity: 'warning',
    code: 'unknown-property',
    message:
      `Property "${key}" is not declared on "${className}". It is preserved ` +
      'verbatim and will round-trip unchanged.',
    path: `${path}/${key}`,
  });
}

/** One authored key/value, with everything the reader needs to place it. */
export interface PropertyReadRequest {
  readonly key: string;
  readonly value: unknown;
  readonly className: string;
  readonly path: string;
  readonly properties: readonly PropertyDescriptor[];
}

/**
 * Places one authored property on an element, reporting whatever is wrong with it.
 *
 * Its own module because it is where a definition's *values* are judged, which is a
 * different job from walking the tree they hang on: three rules already report on a
 * property as it lands, and each one added made the parse loop harder to read for
 * everyone who only wanted to know how children are traversed.
 *
 * A property is never dropped silently. An undeclared one is preserved verbatim, a
 * mistyped one is refused with a message naming both types, and everything else is
 * reported alongside the value rather than instead of it.
 */
export function readProperty(
  element: SurveyElement,
  request: PropertyReadRequest,
  context: ReadContext,
): void {
  const { key, value, className, path, properties } = request;
  const descriptor = properties.find((candidate) => candidate.name === key);

  if (descriptor === undefined) {
    preserveUnknownProperty(element, request, context);
    return;
  }

  if (descriptor.isLocalizable && isLocalizedText(value)) {
    // Stored as authored. Resolving it here would flatten the survey to one language
    // the first time it was read, and the round trip would come back monolingual.
    element.setPropertyValue(key, value);
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

  context.diagnostics.push(
    ...collectPropertyDiagnostics({
      className,
      propertyName: key,
      value,
      path,
      values: context.values,
      isExpression: descriptor.isExpression,
    }),
  );

  element.setPropertyValue(key, value);
}
