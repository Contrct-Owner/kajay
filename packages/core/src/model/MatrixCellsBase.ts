import type { PathSegment } from '../expressions/ExpressionNode.js';
import { MatrixTotal } from './MatrixTotal.js';
import type { CellAttachment } from './matrixCells.js';
import { buildCell, CellValueHost, summarise, toMatrixLayout } from './matrixCells.js';
import type { MatrixLayout } from './matrixCells.js';
import { asAnswerRecord, withAnswerEntry } from './objectAnswers.js';
import { Question } from './Question.js';
import type { ConditionalItemGroup } from './Question.js';
import type { SurveyElement } from './SurveyElement.js';
import type { SurveyError } from './SurveyError.js';
import { collectAnswerErrors } from './validateAnswer.js';
import type { ValidationContext } from './Validator.js';

/** Separates a row from a column in an error's path: `docs.price`. */
const PATH_SEPARATOR = '.';

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
 * What the subclasses decide is where rows come from: fixed by the definition, or added
 * by the respondent.
 */
export abstract class MatrixCellsBase extends Question {
  readonly #columns: Question[] = [];
  readonly #detailElements: Question[] = [];
  readonly #totals: MatrixTotal[] = [];
  readonly #cells: Map<string, readonly Question[]> = new Map();
  readonly #detailCells: Map<string, readonly Question[]> = new Map();
  readonly #expanded: Set<string> = new Set();
  #attachment: CellAttachment | undefined;

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

  /** The detail questions of one row, built and kept exactly as its columns are. */
  detailCellsFor(rowKey: string): readonly Question[] {
    return this.#buildRow(rowKey, this.#detailElements, this.#detailCells);
  }

  /** Every cell of one row: its columns first, then whatever its detail holds. */
  rowCells(rowKey: string): readonly Question[] {
    return [...this.cellsFor(rowKey), ...this.detailCellsFor(rowKey)];
  }

  /** Installed by `parseSurvey`, which owns the registry cells are built from. */
  attachCells(attachment: CellAttachment): void {
    this.#attachment = attachment;
    this.#cells.clear();
  }

  /** Every row that exists, as the key its answers are stored under. */
  abstract get rowKeys(): readonly string[];

  /**
   * Whether a row is currently shown. Every row by default; a fixed matrix asks the row.
   *
   * Cells are built for *every* row rather than the visible ones, because a cell's
   * conditions are registered as graph rules when the tree is walked — and a row that
   * was hidden at that moment would come back later carrying rules nobody registered.
   */
  isRowVisible(_rowKey: string): boolean {
    return true;
  }

  /** The rows a respondent can currently see and answer. */
  get visibleRowKeys(): readonly string[] {
    return this.rowKeys.filter((rowKey) => this.isRowVisible(rowKey));
  }

  /** What the row header reads. */
  abstract rowTitle(rowKey: string): string;

  /** Where this row's answers live, as an expression path. */
  protected abstract rowPath(rowKey: string): readonly PathSegment[];

  /**
   * Where one cell's answer lives, as an expression path.
   *
   * Public because the logic engine declares it: a cell's `defaultValueExpression` or
   * computed `expression` is an ordinary rule, and a rule has to tell the graph what it
   * writes or nothing can be ordered after it.
   */
  cellPath(rowKey: string, columnName: string): readonly PathSegment[] {
    return [...this.rowPath(rowKey), { kind: 'name', name: columnName }];
  }

  /** This row's answers, as one record. */
  protected abstract readRow(rowKey: string): Readonly<Record<string, unknown>>;

  /** Replaces this row's answers. `undefined` removes the row's entry entirely. */
  protected abstract writeRow(rowKey: string, next: Record<string, unknown> | undefined): void;

  /**
   * The cell questions of one row, built once and kept.
   *
   * Stable identity matters as much as the values: a renderer keys rows by it, focus
   * lives in it, and rebuilding on every read would lose both on every keystroke.
   */
  cellsFor(rowKey: string): readonly Question[] {
    return this.#buildRow(rowKey, this.#columns, this.#cells);
  }

  #buildRow(
    rowKey: string,
    templates: readonly Question[],
    cache: Map<string, readonly Question[]>,
  ): readonly Question[] {
    const existing = cache.get(rowKey);
    if (existing !== undefined) {
      return existing;
    }
    const attachment = this.#attachment;
    if (attachment === undefined) {
      // Nothing has supplied a registry, so no cell can be built. Empty rather than
      // thrown: a model assembled by hand is still a legal model, and it renders as a
      // table with no cells rather than taking the page down.
      return [];
    }
    const host = new CellValueHost(
      this,
      (column) => this.readRow(rowKey)[column],
      (column, value) => {
        this.#writeCell(rowKey, column, value);
      },
    );
    const row = { key: rowKey, title: this.rowTitle(rowKey), path: this.rowPath(rowKey) };
    const built = templates.map((template) => {
      const cell = buildCell(template, row, attachment);
      cell.attachValueHost(host);
      return cell;
    });
    cache.set(rowKey, built);
    return built;
  }

  /** Every cell of every row, detail included, in row order. */
  get allCells(): readonly Question[] {
    return this.rowKeys.flatMap((rowKey) => this.rowCells(rowKey));
  }

  /** One cell by name, from the columns or the detail. */
  cellAt(rowKey: string, columnName: string): Question | undefined {
    return this.rowCells(rowKey).find((cell) => cell.name === columnName);
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

  getCellValue(rowKey: string, columnName: string): unknown {
    return this.readRow(rowKey)[columnName];
  }

  /**
   * Takes one cell's answer back.
   *
   * The cell leaves its row rather than being stored as a blank, and the last one to go
   * takes the row with it — the same rule at both levels, so a table nobody answered is
   * `undefined` rather than an object full of empty objects.
   */
  clearCell(rowKey: string, columnName: string): void {
    const { [columnName]: _cleared, ...rest } = this.readRow(rowKey);
    this.writeRow(rowKey, Object.keys(rest).length > 0 ? rest : undefined);
  }

  /** Forgets the built cells, so the next read builds them for the rows there are now. */
  protected invalidateCells(): void {
    this.#cells.clear();
    this.#detailCells.clear();
    this.#expanded.clear();
    this.#attachment?.onRowsChanged();
  }

  #writeCell(rowKey: string, columnName: string, value: unknown): void {
    this.writeRow(rowKey, withAnswerEntry(this.readRow(rowKey), columnName, value));
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
      const outcome = this.#attachment?.evaluate(expression, scope);
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

  /** Cells carry their conditions; the column templates never do — they never render. */
  override get conditionalItems(): readonly ConditionalItemGroup[] {
    return [{ key: 'cell', items: this.allCells }];
  }

  /** An untouched matrix still owes whatever its cells demand. */
  override get checksEmptyAnswer(): boolean {
    return true;
  }

  /**
   * Every cell's own verdict, reported twice on purpose.
   *
   * On the cell, so its renderer draws the message beside the input exactly as it would
   * anywhere else; and returned with a `row.column` path, so the survey knows the matrix
   * is not answered and a host reading `errors` sees the whole picture. Both are
   * produced in the same pass, so they cannot disagree.
   *
   * A hidden cell is not checked, for the reason a hidden question never is: an error
   * the respondent cannot see is one they cannot act on.
   */
  override checkValue(context: ValidationContext): readonly SurveyError[] {
    const errors: SurveyError[] = [];
    for (const rowKey of this.visibleRowKeys) {
      for (const cell of this.rowCells(rowKey)) {
        const own = cell.isVisible ? collectAnswerErrors(cell, context.evaluate) : [];
        cell.setErrors(own);
        for (const error of own) {
          errors.push(Object.assign({}, error, { path: `${rowKey}${PATH_SEPARATOR}${cell.name}` }));
        }
      }
    }
    return errors;
  }

  /**
   * Clearing the matrix's errors clears its cells'.
   *
   * The survey drops recorded errors without re-checking — turning validation off, or
   * leaving a page — and a cell holding a message from a check that no longer counts
   * would go on showing it with nothing to remove it.
   */
  override setErrors(errors: readonly SurveyError[]): boolean {
    if (errors.length === 0) {
      for (const cell of this.allCells) {
        cell.setErrors([]);
      }
    }
    return super.setErrors(errors);
  }

  /** The answer as a record, whatever shape the subclass stores it in. */
  protected get answerRecord(): Readonly<Record<string, unknown>> {
    return asAnswerRecord(this.value);
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
