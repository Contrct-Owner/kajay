import { MatrixTotal } from './MatrixTotal.js';
import { ROW_SCOPE, summarise, toMatrixLayout } from './matrixCells.js';
import type { MatrixLayout } from './matrixCells.js';
import type { PageElement } from './PageElement.js';
import { collectQuestions } from './pageElements.js';
import { Question } from './Question.js';
import { RepeatingQuestion } from './RepeatingQuestion.js';
import type { SurveyElement } from './SurveyElement.js';

/** The scope word a column's expressions use for the row they are in. */

/**
 * A matrix whose cells are questions.
 *
 * Columns are authored as ordinary question definitions — `{ type: 'dropdown', name:
 * 'quality', choices: [...] }` — and each cell is a real instance built from that
 * template and pointed at its own slot in the answer. Everything a question type already
 * does therefore works in a cell: its validators, its choices, its renderer, its
 * `visibleIf`. Nothing about `dropdown` knows a matrix exists.
 *
 * `cellType` in SurveyJS's vocabulary is simply `type` in ours, because a column *is* a
 * question and our format already has a word for what kind of thing something is
 * ([ADR-0001](../../../../docs/adr/0001-own-definition-format.md)).
 *
 * The machinery for that lives in `RepeatingQuestion`, which a dynamic panel uses too.
 * What this adds is what makes a matrix a *table*: columns, a detail under a row, totals
 * beneath, and a layout that gives up on being a table when the screen is too narrow.
 *
 * What the subclasses decide is where rows come from: fixed by the definition, or added
 * by the respondent.
 */
export abstract class MatrixCellsBase extends RepeatingQuestion {
  readonly #columns: Question[] = [];
  readonly #detailElements: Question[] = [];
  readonly #totals: MatrixTotal[] = [];
  readonly #expanded: Set<string> = new Set();

  protected override get scopeName(): string {
    return ROW_SCOPE;
  }

  /** The column templates, exactly as authored. Serialization reads these. */
  get columns(): readonly Question[] {
    return this.#columns;
  }

  get totals(): readonly MatrixTotal[] {
    return this.#totals;
  }

  /**
   * Questions shown under a row rather than in a column of their own — checklist F4.
   *
   * The same cells as the columns, in a different place: built from the same templates
   * by the same builder, pointed at the same row record, checked with the rest. A table
   * runs out of horizontal room long before a form runs out of questions, and this is
   * where the long ones go.
   */
  get detailElements(): readonly Question[] {
    return this.#detailElements;
  }

  /**
   * Whether this table becomes a list on a narrow screen — checklist F6.
   *
   * A statement about the *content*, not about the viewport: a two-column table survives
   * a phone and a nine-column one does not, and only the author knows which this is.
   * Which layout that resolves to is the renderer's decision, because only it can see
   * the screen.
   */
  get mobileMode(): MatrixLayout {
    return toMatrixLayout(this.getStringProperty('mobileMode'));
  }

  /** `none`, `underRow`, or `underRowSingle` — one row open at a time. */
  get detailPanelMode(): string {
    const mode = this.getStringProperty('detailPanelMode');
    return this.#detailElements.length === 0 ? 'none' : mode;
  }

  get hasDetailPanel(): boolean {
    return this.detailPanelMode !== 'none';
  }

  /**
   * Whether a row's detail is open.
   *
   * A detail holding something invalid opens itself and stays open: an error nobody can
   * see is one nobody can fix, and the respondent has just been told the page is wrong
   * without being shown where.
   */
  isRowExpanded(rowKey: string): boolean {
    if (!this.hasDetailPanel) {
      return false;
    }
    return this.#expanded.has(rowKey) || this.#hasDetailErrors(rowKey);
  }

  /** Opens or closes one row's detail. `underRowSingle` closes whatever else was open. */
  setRowExpanded(rowKey: string, isExpanded: boolean): void {
    if (!isExpanded) {
      this.#expanded.delete(rowKey);
      return;
    }
    if (this.detailPanelMode === 'underRowSingle') {
      this.#expanded.clear();
    }
    this.#expanded.add(rowKey);
  }

  #hasDetailErrors(rowKey: string): boolean {
    return this.detailCellsFor(rowKey).some((cell) => cell.hasErrors);
  }

  /**
   * The cell questions of one row.
   *
   * `cells` and `detail` are two groups of templates over one record, which is exactly
   * the distinction the base draws: same builder, same host, different place on screen.
   */
  cellsFor(rowKey: string): readonly Question[] {
    return collectQuestions(this.instancesOf('cells', rowKey, this.#columns));
  }

  /** The detail questions of one row, built and kept exactly as its columns are. */
  detailCellsFor(rowKey: string): readonly Question[] {
    return collectQuestions(this.instancesOf('detail', rowKey, this.#detailElements));
  }

  /** A row's columns first, then whatever its detail holds. */
  protected override rowInstances(rowKey: string): readonly PageElement[] {
    return [
      ...this.instancesOf('cells', rowKey, this.#columns),
      ...this.instancesOf('detail', rowKey, this.#detailElements),
    ];
  }

  /**
   * Whether any row still shows this column.
   *
   * A column's own `visibleIf` is asked of each *cell*, with the row in scope, so
   * hiding a column outright is what happens when every row's cell is hidden. One rule
   * rather than two — a column-level condition and a cell-level one would differ only
   * in which of them an author remembered.
   */
  isColumnVisible(columnName: string): boolean {
    return this.visibleRowKeys.some(
      (rowKey) => this.cellAt(rowKey, columnName)?.isVisible === true,
    );
  }

  /** Rows moved, so which of them was open no longer means anything. */
  protected override invalidateCells(): void {
    this.#expanded.clear();
    super.invalidateCells();
  }

  /**
   * The figure under a column, or undefined when there is nothing to show.
   *
   * Undefined rather than zero for an unanswered column: zero is an answer, and
   * printing it under a column nobody filled in states a result nobody produced.
   */
  totalFor(columnName: string): number | undefined {
    return this.computedTotals.get(columnName);
  }

  /** The figure as the respondent reads it, formatted by the total's own template. */
  totalText(columnName: string): string {
    const total = this.#totals.find((candidate) => candidate.column === columnName);
    return total?.display(this.totalFor(columnName)) ?? '';
  }

  /**
   * Every total, computed in declaration order.
   *
   * Order matters because a total may be an *expression* over the others: `{row.price}`
   * in a total means that column's total, so a line total can be `{row.unit} *
   * {row.quantity}` — the same `row` scope a cell condition uses, one level up. A total
   * naming one declared after it sees nothing, which is the same rule a spreadsheet
   * would apply and cheaper to explain than a second dependency graph for four numbers.
   */
  get computedTotals(): ReadonlyMap<string, number | undefined> {
    const computed = new Map<string, number | undefined>();
    for (const total of this.#totals) {
      computed.set(total.column, this.#computeTotal(total, computed));
    }
    return computed;
  }

  #computeTotal(
    total: MatrixTotal,
    computed: ReadonlyMap<string, number | undefined>,
  ): number | undefined {
    const expression = total.expression;
    if (expression.length > 0) {
      const scope = Object.fromEntries(computed);
      const outcome = this.attachment?.evaluate(expression, scope);
      // A broken total shows nothing rather than a wrong number: a figure under a
      // column is read as a fact, and there is no way to caveat one in a table cell.
      return typeof outcome === 'number' && Number.isFinite(outcome) ? outcome : undefined;
    }
    const kind = total.kind;
    if (kind === undefined) {
      return undefined;
    }
    // Visible rows only: a total is something the respondent is being shown, and one
    // that counted answers to questions nobody can see would not add up on the screen.
    return summarise(
      kind,
      this.visibleRowKeys.map((rowKey) => this.getCellValue(rowKey, total.column)),
    );
  }

  override getChildren(property: string): readonly SurveyElement[] {
    if (property === 'columns') {
      return this.#columns;
    }
    if (property === 'detailElements') {
      return this.#detailElements;
    }
    return property === 'totals' ? this.#totals : super.getChildren(property);
  }

  override addChild(property: string, child: SurveyElement): void {
    if (property === 'totals') {
      if (!(child instanceof MatrixTotal)) {
        throw new Error(`totals accepts matrix totals; received "${child.type}".`);
      }
      this.#totals.push(child);
      return;
    }
    const questions = this.#questionCollection(property);
    if (questions === undefined) {
      super.addChild(property, child);
      return;
    }
    if (!(child instanceof Question)) {
      throw new Error(`${property} accepts questions; received "${child.type}".`);
    }
    questions.push(child);
  }

  #questionCollection(property: string): Question[] | undefined {
    if (property === 'columns') {
      return this.#columns;
    }
    return property === 'detailElements' ? this.#detailElements : undefined;
  }
}
