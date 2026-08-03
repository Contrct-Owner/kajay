import { PageElement } from './PageElement.js';
import type { SurveyElement } from './SurveyElement.js';
import type { SurveyError } from './SurveyError.js';
import { Validator } from './Validator.js';
import type { ValidationContext } from './Validator.js';
import type { ValueHost } from './ValueHost.js';

/**
 * A collection of a question's items that carry conditions of their own.
 *
 * `key` names the collection for rule identity only — a choice, a matrix row and a
 * matrix column all sit under the same question, and two rules cannot share a key.
 */
export interface ConditionalItemGroup {
  readonly key: string;
  readonly items: readonly SurveyElement[];
}

const NO_CONDITIONAL_ITEMS: readonly ConditionalItemGroup[] = [];

/** Base for every question type. Answers live in the host, never on the question. */
export abstract class Question extends PageElement {
  readonly #validators: Validator[] = [];
  #valueHost: ValueHost | undefined;
  #instanceKey: string | undefined;
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

  /**
   * Whether a single action finishes this answer.
   *
   * False here, and true for the types where picking *is* answering — a radiogroup, a
   * rating, a boolean. It is what `goNextPageAutomatic` asks before turning the page:
   * a text question is answered a character at a time, and a survey that moved on after
   * the first letter of a name would be unusable.
   *
   * A fact the question type states about itself rather than a list kept somewhere
   * else, because that list would be wrong the day a new type arrived.
   */
  get answersInOneStep(): boolean {
    return false;
  }

  /**
   * What tells two instances of this question apart. The name, ordinarily.
   *
   * Matrix cells are the exception that made it necessary: every cell in a column is a
   * question *named for the column*, because that is the key its answer is stored under
   * and the name a `{row.price}` condition uses. Two cells therefore share a name, and a
   * renderer building a DOM id out of the name alone emits the same id twice — which a
   * browser resolves by pointing every label at the first input, so typing in the second
   * row wrote into the first. Found by a totals test that added up to the wrong number.
   */
  get instanceKey(): string {
    return this.#instanceKey ?? this.name;
  }

  /** Set when a question is one instance among several, as a matrix cell is. */
  setInstanceKey(key: string): void {
    this.#instanceKey = key;
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
   * Whether `checkValue` has something to say about an answer that is empty.
   *
   * False for a question holding one answer, where an empty value means one omission and
   * one message — the reasoning that keeps validators away from an empty answer in the
   * first place. A composite question is the exception: a matrix row and a multipletext
   * field carry their own requiredness and their own place on screen, so an untouched
   * question is several omissions, each with somewhere to be reported.
   */
  get checksEmptyAnswer(): boolean {
    return false;
  }

  /**
   * Items of this question that carry their own `visibleIf` and friends.
   *
   * Asked of every question at rule registration, so a new type gains conditional items
   * by answering this rather than by being added to a list somewhere else — the same
   * reasoning as `answersInOneStep`, and the reason choices are no longer a special case
   * there.
   */
  get conditionalItems(): readonly ConditionalItemGroup[] {
    return NO_CONDITIONAL_ITEMS;
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

  /**
   * The key this question's answer is stored under — checklist G3.
   *
   * Its own name, unless `valueName` says otherwise. Two questions sharing a `valueName`
   * share an answer, which is the point: the same thing asked on two paths through a
   * survey should come back as one field, and inside a repeating panel it is how an
   * instance reads a value the whole survey shares.
   *
   * Identity stays with `name` — that is what a rule, a condition and `getQuestionByName`
   * use — because two questions that share an answer are still two questions.
   */
  get valueKey(): string {
    const authored = this.getStringProperty('valueName');
    return authored.length > 0 ? authored : this.name;
  }

  get value(): unknown {
    return this.#valueHost?.getValue(this.valueKey);
  }

  set value(next: unknown) {
    this.#valueHost?.setValue(this.valueKey, next);
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
