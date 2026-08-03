import type { PathSegment } from '../expressions/ExpressionNode.js';
import { MatrixCellsBase } from './MatrixCellsBase.js';
import { asAnswerRecord } from './objectAnswers.js';

/** Rows the respondent creates are numbered, so their keys are their positions. */
function rowIndex(rowKey: string): number {
  return Math.trunc(Number(rowKey));
}

function asRows(value: unknown): readonly Readonly<Record<string, unknown>>[] {
  return Array.isArray(value) ? value.map((row) => asAnswerRecord(row)) : [];
}

/**
 * A table of question cells whose rows the respondent adds and removes — checklist F3.
 *
 * The answer is an array of row objects, so the rows *are* the data: `[{ item: 'Pens',
 * quantity: 2 }]`. That is what makes the row count survive a save and resume without
 * anything being stored beside the answers — a count kept somewhere else would be a
 * second source of truth for how many rows there are, and the two would disagree the
 * first time a host wrote `data` directly.
 *
 * An empty row is `{}` and stays in the array, because a respondent who pressed Add
 * created something: dropping it on the next render would be the survey arguing with
 * them. Rows below `minRowCount` are implied rather than stored, so a matrix nobody has
 * touched is still `undefined` and not a page of blanks in the response.
 */
export class MatrixDynamicQuestion extends MatrixCellsBase {
  override get type(): string {
    return 'matrixdynamic';
  }

  /** How many rows are on screen: what has been stored, or the minimum, whichever is more. */
  get rowCount(): number {
    return Math.max(asRows(this.value).length, this.minRowCount);
  }

  get minRowCount(): number {
    return Math.max(this.getNumberProperty('minRowCount'), 0);
  }

  /** 0 means no limit. */
  get maxRowCount(): number {
    return this.getNumberProperty('maxRowCount');
  }

  get allowAddRows(): boolean {
    return this.getBooleanProperty('allowAddRows');
  }

  get allowRemoveRows(): boolean {
    return this.getBooleanProperty('allowRemoveRows');
  }

  get addRowText(): string {
    return this.getStringProperty('addRowText');
  }

  get removeRowText(): string {
    return this.getStringProperty('removeRowText');
  }

  /** Whether removing a row asks first. What that looks like is the renderer's business. */
  get confirmDelete(): boolean {
    return this.getBooleanProperty('confirmDelete');
  }

  get confirmDeleteText(): string {
    return this.getStringProperty('confirmDeleteText');
  }

  /** Answers a new row starts with. */
  get defaultRowValue(): Readonly<Record<string, unknown>> {
    return asAnswerRecord(this.getPropertyValue('defaultRowValue'));
  }

  /** Whether a new row starts as a copy of the one before it. */
  get defaultValueFromLastRow(): boolean {
    return this.getBooleanProperty('defaultValueFromLastRow');
  }

  override get rowKeys(): readonly string[] {
    return Array.from({ length: this.rowCount }, (_unused, index) => String(index));
  }

  /** `rowTitleFormat` with `{0}` as the row's number, or just the number. */
  override rowTitle(rowKey: string): string {
    const number = String(rowIndex(rowKey) + 1);
    const format = this.getStringProperty('rowTitleFormat');
    return format.length > 0 ? format.replaceAll('{0}', number) : number;
  }

  /** `{basket[0].price}` — an index, so `{row.price}` in a column scopes to the row. */
  protected override rowPath(rowKey: string): readonly PathSegment[] {
    return [
      { kind: 'name', name: this.name },
      { kind: 'index', index: rowIndex(rowKey) },
    ];
  }

  protected override readRow(rowKey: string): Readonly<Record<string, unknown>> {
    return asRows(this.value)[rowIndex(rowKey)] ?? {};
  }

  protected override writeRow(rowKey: string, next: Record<string, unknown> | undefined): void {
    const index = rowIndex(rowKey);
    // Padded to the row being written, so answering the third of three implied rows
    // does not leave holes the array cannot represent.
    const rows = [...asRows(this.value)];
    while (rows.length <= index) {
      rows.push({});
    }
    rows[index] = next ?? {};
    this.value = rows;
  }

  get canAddRow(): boolean {
    return this.allowAddRows && (this.maxRowCount <= 0 || this.rowCount < this.maxRowCount);
  }

  get canRemoveRow(): boolean {
    return this.allowRemoveRows && this.rowCount > this.minRowCount;
  }

  /**
   * Adds a row and gives it whatever a new row starts with.
   *
   * `defaultValueFromLastRow` wins over `defaultRowValue` when both are set: copying the
   * row before is the more specific statement — it is what an author asks for when every
   * row is a variation of the last — and a fixed default would overwrite it.
   */
  addRow(): void {
    if (!this.canAddRow) {
      return;
    }
    const rows = [...asRows(this.value)];
    while (rows.length < this.rowCount) {
      rows.push({});
    }
    // Copied, not referenced: `defaultRowValue` is part of the definition, and putting
    // that object into the answers hands a host the survey it was given to edit.
    rows.push({ ...this.#newRowValue(rows) });
    this.value = rows;
    this.invalidateCells();
  }

  #newRowValue(rows: readonly Readonly<Record<string, unknown>>[]): Readonly<Record<string, unknown>> {
    if (this.defaultValueFromLastRow) {
      return rows.at(-1) ?? this.defaultRowValue;
    }
    return this.defaultRowValue;
  }

  /**
   * Removes one row, closing the gap.
   *
   * The rows after it move up, and the *answers* move with them — cells read their row
   * live, by index, so the values need nothing done to them.
   *
   * The cells are rebuilt anyway, and this is hygiene rather than correctness: the
   * conditions of the row that no longer exists are still registered as graph rules
   * until the next refresh, evaluating against a path nothing can reach. Nothing
   * observable comes of that, so no test pins it and a mutation removing this call
   * survives; without it the stale rules accumulate one per removal for the life of
   * the survey.
   */
  removeRow(rowKey: string): void {
    const index = rowIndex(rowKey);
    if (!this.canRemoveRow || index < 0 || index >= this.rowCount) {
      return;
    }
    const rows = [...asRows(this.value)];
    while (rows.length < this.rowCount) {
      rows.push({});
    }
    rows.splice(index, 1);
    // Back to nothing rather than an empty array, so a matrix emptied to its minimum
    // leaves the response the way an emptied answer does everywhere else.
    this.value = rows.length > 0 ? rows : undefined;
    this.invalidateCells();
  }
}
