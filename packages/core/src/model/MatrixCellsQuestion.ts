import type { PathSegment } from '../expressions/ExpressionNode.js';
import { ItemValue } from './ItemValue.js';
import { matrixRowKey } from './MatrixQuestion.js';
import { MatrixCellsBase } from './MatrixCellsBase.js';
import { asAnswerRecord, withAnswerEntry } from './objectAnswers.js';
import type { ConditionalItemGroup } from './Question.js';
import type { SurveyElement } from './SurveyElement.js';

/**
 * A table of question cells with the rows fixed by the definition — checklist F2.
 *
 * The answer is an object of objects, keyed by row value and then by column name:
 * `{ docs: { quality: 'good', notes: '…' } }`. That is the same shape a multipletext and
 * the single-select matrix already store, one level deeper, so `{review.docs.quality}`
 * reaches a single cell from anywhere with nothing added for it.
 *
 * SurveyJS calls this `matrixdropdown`, which is a name from the days when the cells
 * were dropdowns. Ours says what it is: a matrix whose cells are questions.
 */
export class MatrixCellsQuestion extends MatrixCellsBase {
  readonly #rows: ItemValue[] = [];

  override get type(): string {
    return 'matrixcells';
  }

  get rows(): readonly ItemValue[] {
    return this.#rows;
  }

  override get rowKeys(): readonly string[] {
    return this.#rows.map((row) => matrixRowKey(row));
  }

  override isRowVisible(rowKey: string): boolean {
    return this.#row(rowKey)?.isVisible ?? false;
  }

  override rowTitle(rowKey: string): string {
    return this.#row(rowKey)?.text ?? rowKey;
  }

  protected override rowPath(rowKey: string): readonly PathSegment[] {
    return [
      { kind: 'name', name: this.name },
      { kind: 'name', name: rowKey },
    ];
  }

  protected override readRow(rowKey: string): Readonly<Record<string, unknown>> {
    return asAnswerRecord(this.answerRecord[rowKey]);
  }

  /**
   * A row with nothing left in it leaves the answer entirely.
   *
   * Two levels of the same rule: an emptied cell leaves its row, and an emptied row
   * leaves the matrix, so a matrix nobody answered is `undefined` rather than an object
   * full of empty objects — which no emptiness test would see through.
   */
  protected override writeRow(rowKey: string, next: Record<string, unknown> | undefined): void {
    this.value = withAnswerEntry(this.value, rowKey, next);
  }

  /** The rows carry `visibleIf` of their own, alongside every cell's. */
  override get conditionalItems(): readonly ConditionalItemGroup[] {
    return [{ key: 'row', items: this.#rows }, ...super.conditionalItems];
  }

  #row(rowKey: string): ItemValue | undefined {
    return this.#rows.find((row) => matrixRowKey(row) === rowKey);
  }

  override getChildren(property: string): readonly SurveyElement[] {
    return property === 'rows' ? this.#rows : super.getChildren(property);
  }

  override addChild(property: string, child: SurveyElement): void {
    if (property !== 'rows') {
      super.addChild(property, child);
      return;
    }
    if (!(child instanceof ItemValue)) {
      throw new Error(`rows accepts choice items; received "${child.type}".`);
    }
    this.#rows.push(child);
  }
}
