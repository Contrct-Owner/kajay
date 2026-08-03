import { SurveyElement } from './SurveyElement.js';
import { Validator } from './Validator.js';

/**
 * One field inside a multipletext question.
 *
 * Not a `Question`: it has no `visibleIf` of its own, no place on a page, and no
 * independent answer — the whole set is stored under the question's name. What it does
 * carry is its own requiredness and its own validators, which is the entire point of
 * the type. A street address and a postcode want different rules and one label.
 */
export class MultipleTextItem extends SurveyElement {
  readonly #validators: Validator[] = [];

  override get type(): string {
    return 'multipletextitem';
  }

  /** The key this field's value is stored under, inside the question's answer. */
  get name(): string {
    return this.getStringProperty('name');
  }

  set name(value: string) {
    this.setPropertyValue('name', value);
  }

  /** Display label, falling back to the name — the same rule a page element follows. */
  get title(): string {
    const title = this.getStringProperty('title');
    return title.length > 0 ? title : this.name;
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

  /** Field width in characters. Zero defers to the question's `itemSize`. */
  get size(): number {
    return this.getNumberProperty('size');
  }

  get validators(): readonly Validator[] {
    return this.#validators;
  }

  override getChildren(property: string): readonly SurveyElement[] {
    return property === 'validators' ? this.#validators : [];
  }

  override addChild(property: string, child: SurveyElement): void {
    if (property !== 'validators') {
      throw new Error(`A multipletext item does not accept children under "${property}".`);
    }
    if (!(child instanceof Validator)) {
      throw new Error(`validators accepts validators; received "${child.type}".`);
    }
    this.#validators.push(child);
  }
}
