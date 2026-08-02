import { PageElement } from './PageElement.js';
import type { SurveyElement } from './SurveyElement.js';
import type { SurveyError } from './SurveyError.js';
import { Validator } from './Validator.js';
import type { ValidationContext } from './Validator.js';
import type { ValueHost } from './ValueHost.js';

/** Base for every question type. Answers live in the host, never on the question. */
export abstract class Question extends PageElement {
  readonly #validators: Validator[] = [];
  #valueHost: ValueHost | undefined;
  #requiredOverride: boolean | undefined;
  #errors: readonly SurveyError[] = [];

  /**
   * Whether an answer is demanded right now.
   *
   * `requiredIf`, when present, drives this and overrides the authored `isRequired`:
   * the conditional rule is the more specific statement of intent. With no
   * `requiredIf`, the stored property answers.
   *
   * Serialization reads the stored property directly, so the override never leaks
   * into the definition.
   */
  get isRequired(): boolean {
    return this.#requiredOverride ?? this.getBooleanProperty('isRequired');
  }

  set isRequired(value: boolean) {
    this.setPropertyValue('isRequired', value);
  }

  /** Set by the logic engine. `undefined` hands control back to the stored property. */
  setRequiredOverride(isRequired: boolean | undefined): void {
    this.#requiredOverride = isRequired;
  }

  /**
   * Whether this question is for reading rather than answering.
   *
   * True when the whole survey is read-only or this question was authored that way. The
   * two are one state to a renderer, and asking it to combine them itself is how one
   * adapter ends up honouring the survey-wide flag and another only the per-question
   * one.
   *
   * **Not the same as disabled.** A disabled control leaves the tab order and stops
   * being readable; a read-only one keeps its value, its focus and its announcement,
   * which is exactly what someone reviewing what they submitted needs.
   *
   * It does not block programmatic writes. Logic and triggers write into read-only
   * questions on purpose — that is what makes a computed field that nobody may type
   * into work at all.
   */
  get isReadOnly(): boolean {
    return (this.#valueHost?.isReadOnly ?? false) || this.getBooleanProperty('readOnly');
  }

  /** Author's replacement for the built-in "this is required" message. */
  get requiredErrorText(): string {
    return this.getStringProperty('requiredErrorText');
  }

  set requiredErrorText(value: string) {
    this.setPropertyValue('requiredErrorText', value);
  }

  /** Extra rules the answer has to satisfy, in the order they are checked. */
  get validators(): readonly Validator[] {
    return this.#validators;
  }

  /**
   * Checks intrinsic to the question type, before any authored validator runs.
   *
   * A type whose own properties constrain the answer — a text question's `min`/`max`,
   * a multipletext's per-item rules — states that here rather than requiring the author
   * to add a validator that repeats what the property already said. Never called with
   * an empty answer, on the same reasoning that keeps validators away from one.
   *
   * Handed the whole validation context rather than just the value, because a composite
   * question runs its parts' own validators — including expression ones, which need an
   * evaluator.
   */
  checkValue(_context: ValidationContext): readonly SurveyError[] {
    return [];
  }

  /**
   * Why the current answer is unacceptable, or empty when it is fine.
   *
   * Empty before anything has been validated, which is not the same as "valid": a
   * question nobody has checked yet has no errors to report. `Survey` decides when to
   * check, because *when* is a survey-wide policy (`checkErrorsMode`), not something a
   * single question can know.
   */
  get errors(): readonly SurveyError[] {
    return this.#errors;
  }

  get hasErrors(): boolean {
    return this.#errors.length > 0;
  }

  /** Replaces the recorded errors. Returns whether anything actually changed. */
  setErrors(errors: readonly SurveyError[]): boolean {
    if (!errorListsDiffer(this.#errors, errors)) {
      return false;
    }
    this.#errors = errors;
    return true;
  }

  override getChildren(property: string): readonly SurveyElement[] {
    return property === 'validators' ? this.#validators : [];
  }

  override addChild(property: string, child: SurveyElement): void {
    if (property !== 'validators') {
      throw new Error(`"${this.type}" does not accept children under "${property}".`);
    }
    if (!(child instanceof Validator)) {
      throw new Error(`validators accepts validators; received "${child.type}".`);
    }
    this.#validators.push(child);
  }

  get value(): unknown {
    return this.#valueHost?.getValue(this.name);
  }

  set value(next: unknown) {
    this.#valueHost?.setValue(this.name, next);
  }

  attachValueHost(host: ValueHost): void {
    this.#valueHost = host;
  }
}

/**
 * Compares by content, not identity.
 *
 * Errors are rebuilt from scratch on every check, so identity always differs — and a
 * change notification on every keystroke would re-render the whole page for nothing.
 */
function errorListsDiffer(left: readonly SurveyError[], right: readonly SurveyError[]): boolean {
  if (left.length !== right.length) {
    return true;
  }
  return left.some((error, index) => {
    const other = right[index];
    return other === undefined || other.kind !== error.kind || other.text !== error.text;
  });
}
