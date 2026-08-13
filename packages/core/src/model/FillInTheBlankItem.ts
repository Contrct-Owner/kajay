import { SurveyElement } from './SurveyElement.js';
import { Validator } from './Validator.js';

/**
 * One blank a template positions — checklist C13,
 * [ADR-0048](../../../../docs/adr/0048-fill-in-the-blank-question.md).
 *
 * **The template positions; this declares.** Everything a blank needs beyond its place in
 * the sentence — what marks it, what a screen reader calls it, how it is matched — lives
 * here rather than in the prose, because the prose is a string a translator edits and a
 * correct answer inside it would mean a translation could change the marking.
 *
 * Not a `Question`, for the reasons `MultipleTextItem` is not: no `visibleIf`, no place on
 * a page, no independent answer. The whole set is stored under the question's name.
 */
export class FillInTheBlankItem extends SurveyElement {
  readonly #validators: Validator[] = [];

  override get type(): string {
    return 'fillintheblankitem';
  }

  /** The key this blank's answer is stored under, inside the question's answer. */
  get name(): string {
    return this.getStringProperty('name');
  }

  set name(value: string) {
    this.setPropertyValue('name', value);
  }

  /**
   * What a screen reader calls this blank, falling back to the name.
   *
   * Load-bearing rather than decorative: the sentence labels a blank visually and not
   * programmatically, so without this a reader announces "edit text, blank" and the
   * respondent who most needs the prose read to them learns least from it.
   */
  get label(): string {
    const label = this.getStringProperty('label');
    return label.length > 0 ? label : this.name;
  }

  get inputType(): string {
    return this.getStringProperty('inputType');
  }

  get placeholder(): string {
    return this.getStringProperty('placeholder');
  }

  get isRequired(): boolean {
    return this.getBooleanProperty('isRequired');
  }

  get requiredErrorText(): string {
    return this.getStringProperty('requiredErrorText');
  }

  /** Width in characters. Zero defers to the question. */
  get size(): number {
    return this.getNumberProperty('size');
  }

  /** The answer that scores this blank. A blank without one is not marked. */
  get correctAnswer(): unknown {
    return this.getPropertyValue('correctAnswer');
  }

  /**
   * Whether surrounding whitespace is ignored when marking. On by default.
   *
   * An assessment that marks a trailing space wrong is measuring typing rather than the
   * subject, which is the same reasoning behind {@link caseSensitive}.
   */
  get trim(): boolean {
    return this.getBooleanProperty('trim');
  }

  /** Whether case matters when marking. Off by default; a code or a password sets it. */
  get caseSensitive(): boolean {
    return this.getBooleanProperty('caseSensitive');
  }

  get validators(): readonly Validator[] {
    return this.#validators;
  }

  override getChildren(property: string): readonly SurveyElement[] {
    return property === 'validators' ? this.#validators : [];
  }

  override addChild(property: string, child: SurveyElement): void {
    if (property !== 'validators') {
      throw new Error(`A fill-in-the-blank item does not accept children under "${property}".`);
    }
    if (!(child instanceof Validator)) {
      throw new Error(`validators accepts validators; received "${child.type}".`);
    }
    this.#validators.push(child);
  }
}
