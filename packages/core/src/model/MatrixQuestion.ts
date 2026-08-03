import { isEmptyValue, valuesAreEqual } from '../expressions/expressionValues.js';
import { ItemValue } from './ItemValue.js';
import { toMatrixLayout } from './matrixCells.js';
import type { MatrixLayout } from './matrixCells.js';
import { asAnswerRecord, withAnswerEntry } from './objectAnswers.js';
import { Question } from './Question.js';
import type { ConditionalItemGroup } from './Question.js';
import type { SurveyElement } from './SurveyElement.js';
import type { SurveyError } from './SurveyError.js';
import type { ValidationContext } from './Validator.js';

const DEFAULT_ROW_REQUIRED_TEXT = 'This row requires an answer.';
const UNIQUE_ROW_TEXT = 'Each row needs a different answer.';

/** The kind reported when two rows share a column. Matched on, never displayed. */
const UNIQUE_ROW_KIND = 'eachrowunique';

/**
 * The key one row's answer is stored under.
 *
 * A row's value may be a number or a boolean, and an object key is a string either way —
 * so the conversion happens once, here, rather than wherever someone happens to need it.
 * A renderer matching errors to rows uses the same function the model reported them
 * with, which is the only way the two can agree.
 */
export function matrixRowKey(row: ItemValue): string {
  return String(row.value);
}

/**
 * One question asked of several rows, each answered by picking a column.
 *
 * The answer is an object keyed by row value — `{ docs: 1, support: 3 }` — stored under
 * the question's own name, exactly as a multipletext stores its fields. That makes
 * `{comparison.docs}` reach a single row from anywhere without anything being added for
 * it, and it means an empty matrix collapses to `undefined` rather than lingering as an
 * `{}` that no emptiness test would catch.
 */
export class MatrixQuestion extends Question {
  readonly #rows: ItemValue[] = [];
  readonly #columns: ItemValue[] = [];

  override get type(): string {
    return 'matrix';
  }

  get rows(): readonly ItemValue[] {
    return this.#rows;
  }

  get columns(): readonly ItemValue[] {
    return this.#columns;
  }

  /**
   * The rows a respondent can currently answer.
   *
   * Everything that demands or reads an answer goes through this rather than `rows`: a
   * hidden row asking for an answer nobody can give is an unfixable validation error,
   * which is the same rule that keeps a hidden question out of the check.
   */
  get visibleRows(): readonly ItemValue[] {
    return this.#rows.filter((row) => row.isVisible);
  }

  get visibleColumns(): readonly ItemValue[] {
    return this.#columns.filter((column) => column.isVisible);
  }

  /** Whether every visible row demands an answer, rather than the question as a whole. */
  get isAllRowRequired(): boolean {
    return this.getBooleanProperty('isAllRowRequired');
  }

  /** Whether two rows may share a column. */
  get eachRowUnique(): boolean {
    return this.getBooleanProperty('eachRowUnique');
  }

  /** Whether this table becomes a list on a narrow screen — checklist F6. */
  get mobileMode(): MatrixLayout {
    return toMatrixLayout(this.getStringProperty('mobileMode'));
  }

  /** Shade alternate rows. Presentation only — the model does nothing else with it. */
  get alternateRows(): boolean {
    return this.getBooleanProperty('alternateRows');
  }

  /** Rows and columns both carry `visibleIf`, and their keys must not collide. */
  override get conditionalItems(): readonly ConditionalItemGroup[] {
    return [
      { key: 'row', items: this.#rows },
      { key: 'column', items: this.#columns },
    ];
  }

  /**
   * An untouched matrix still owes an answer for every row when `isAllRowRequired`.
   *
   * Only then: `eachRowUnique` has nothing to say about an answer that does not exist.
   */
  override get checksEmptyAnswer(): boolean {
    return this.isAllRowRequired;
  }

  getRowValue(row: ItemValue): unknown {
    return asAnswerRecord(this.value)[matrixRowKey(row)];
  }

  /** Records one row's answer. */
  setRowValue(row: ItemValue, columnValue: unknown): void {
    this.value = withAnswerEntry(this.value, matrixRowKey(row), columnValue);
  }

  /**
   * Takes one row's answer back.
   *
   * The row leaves the answer object rather than being stored as a blank, and a matrix
   * whose last answered row is cleared stops being an answer at all — which is what
   * makes a question-level `isRequired` mean anything here.
   */
  clearRow(row: ItemValue): void {
    this.setRowValue(row, undefined);
  }

  /**
   * Whether this cell is the one currently chosen in its row.
   *
   * The comparison lives here rather than in a renderer because an answer restored from
   * storage or written by a host arrives as whatever JSON made of it — `"1"` where the
   * column says `1` — and every adapter must decide that identically. It is also the
   * kind of rule that is worth testing without a DOM.
   */
  isSelected(row: ItemValue, column: ItemValue): boolean {
    const answer = this.getRowValue(row);
    return !isEmptyValue(answer) && valuesAreEqual(answer, column.value);
  }

  /**
   * At most one objection per row, in row order.
   *
   * Reported against the row rather than the question, on the reasoning `SurveyError`'s
   * `path` exists for: a matrix with eight rows and one message at the top tells a
   * respondent that something is wrong and not where.
   */
  override checkValue(context: ValidationContext): readonly SurveyError[] {
    const answers = asAnswerRecord(context.value);
    const errors: SurveyError[] = [];
    const taken = new Set<string>();

    for (const row of this.visibleRows) {
      const key = matrixRowKey(row);
      const answer = answers[key];
      if (isEmptyValue(answer)) {
        if (this.isAllRowRequired) {
          errors.push({ kind: 'required', text: this.#rowRequiredText, path: key });
        }
        continue;
      }
      if (!this.eachRowUnique) {
        continue;
      }
      const column = String(answer);
      if (taken.has(column)) {
        errors.push({ kind: UNIQUE_ROW_KIND, text: UNIQUE_ROW_TEXT, path: key });
      }
      taken.add(column);
    }
    return errors;
  }

  /** The author's `requiredErrorText` applies to a row, which is what asks for an answer. */
  get #rowRequiredText(): string {
    const authored = this.requiredErrorText;
    return authored.length > 0 ? authored : DEFAULT_ROW_REQUIRED_TEXT;
  }

  override getChildren(property: string): readonly SurveyElement[] {
    if (property === 'rows') {
      return this.#rows;
    }
    return property === 'columns' ? this.#columns : super.getChildren(property);
  }

  override addChild(property: string, child: SurveyElement): void {
    const collection = this.#collection(property);
    if (collection === undefined) {
      super.addChild(property, child);
      return;
    }
    if (!(child instanceof ItemValue)) {
      throw new Error(`${property} accepts choice items; received "${child.type}".`);
    }
    collection.push(child);
  }

  #collection(property: string): ItemValue[] | undefined {
    if (property === 'rows') {
      return this.#rows;
    }
    return property === 'columns' ? this.#columns : undefined;
  }
}
