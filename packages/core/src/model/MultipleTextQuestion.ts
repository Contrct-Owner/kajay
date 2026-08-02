import { isEmptyValue } from '../expressions/expressionValues.js';
import { MultipleTextItem } from './MultipleTextItem.js';
import { Question } from './Question.js';
import type { SurveyElement } from './SurveyElement.js';
import type { SurveyError } from './SurveyError.js';
import type { ValidationContext } from './Validator.js';

const DEFAULT_REQUIRED_TEXT = 'This question requires an answer.';

/** The answer shape: one entry per item that has been filled in. */
function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Several short fields under one label.
 *
 * The answer is an object keyed by item name, stored under the question's own name —
 * which means an expression elsewhere can reach a single field as `{address.city}`,
 * because the path resolver already walks dotted references. Nothing had to be added
 * for that; it is what storing a real object rather than a flattened prefix buys.
 */
export class MultipleTextQuestion extends Question {
  readonly #items: MultipleTextItem[] = [];

  override get type(): string {
    return 'multipletext';
  }

  get items(): readonly MultipleTextItem[] {
    return this.#items;
  }

  /** Default field width in characters. An item's own `size` wins. */
  get itemSize(): number {
    return this.getNumberProperty('itemSize');
  }

  /** How many fields sit side by side. */
  get colCount(): number {
    const columns = this.getNumberProperty('colCount');
    return columns > 0 ? columns : 1;
  }

  getItemValue(name: string): unknown {
    return asRecord(this.value)[name];
  }

  /**
   * Records one field's value.
   *
   * Empty fields are dropped rather than stored as `""`, and an answer with nothing
   * left in it becomes `undefined` rather than `{}`. Both matter: `{}` is not empty by
   * any test the engine applies, so a question-level `isRequired` would be satisfied by
   * an object full of blanks, and `data` would carry a key for a question nobody
   * answered.
   */
  setItemValue(name: string, value: unknown): void {
    const next = { ...asRecord(this.value), [name]: value };
    const filled = Object.entries(next).filter(([, entry]) => !isEmptyValue(entry));
    this.value = filled.length > 0 ? Object.fromEntries(filled) : undefined;
  }

  /**
   * Each item's own rules, reported against the field that earned them.
   *
   * `path` rather than a title prefix, so a renderer can put the message beside the
   * input rather than in a list where every line has to repeat a label the field is
   * already showing.
   */
  override checkValue(context: ValidationContext): readonly SurveyError[] {
    const record = asRecord(context.value);
    return this.#items.flatMap((item) => checkItem(item, record[item.name], context));
  }

  override getChildren(property: string): readonly SurveyElement[] {
    return property === 'items' ? this.#items : super.getChildren(property);
  }

  override addChild(property: string, child: SurveyElement): void {
    if (property !== 'items') {
      super.addChild(property, child);
      return;
    }
    if (!(child instanceof MultipleTextItem)) {
      throw new Error(`items accepts multipletext items; received "${child.type}".`);
    }
    this.#items.push(child);
  }
}

function checkItem(
  item: MultipleTextItem,
  value: unknown,
  context: ValidationContext,
): readonly SurveyError[] {
  if (isEmptyValue(value)) {
    if (!item.isRequired) {
      return [];
    }
    const authored = item.requiredErrorText;
    return [
      {
        kind: 'required',
        text: authored.length > 0 ? authored : DEFAULT_REQUIRED_TEXT,
        path: item.name,
      },
    ];
  }
  // The item's own value, not the question's: a validator asked about a postcode must
  // be shown the postcode, not the object it lives in.
  const itemContext = { value, evaluate: context.evaluate };
  return item.validators.flatMap((validator) => {
    const error = validator.validate(itemContext);
    return error === undefined ? [] : [{ ...error, path: item.name }];
  });
}
