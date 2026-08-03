import type { PathSegment } from '../expressions/ExpressionNode.js';
import { MatrixTotal } from './MatrixTotal.js';
import type { CellAttachment } from './matrixCells.js';
import { buildCell, CellValueHost, summarise } from './matrixCells.js';
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
  readonly #totals: MatrixTotal[] = [];
  readonly #cells: Map<string, readonly Question[]> = new Map();
  #attachment: CellAttachment | undefined;

  /** The column templates, exactly as authored. Serialization reads these. */
  get columns(): readonly Question[] {
    return this.#columns;
  }

  get totals(): readonly MatrixTotal[] {
    return this.#totals;
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
    const existing = this.#cells.get(rowKey);
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
    const built = this.#columns.map((column) => {
      const cell = buildCell(
        column,
        { key: rowKey, title: this.rowTitle(rowKey), path: this.rowPath(rowKey) },
        attachment,
      );
      cell.attachValueHost(host);
      return cell;
    });
    this.#cells.set(rowKey, built);
    return built;
  }

  /** Every cell of every row, in row order. */
  get allCells(): readonly Question[] {
    return this.rowKeys.flatMap((rowKey) => this.cellsFor(rowKey));
  }

  /** One cell, or undefined when the column is not one of this matrix's. */
  cellAt(rowKey: string, columnName: string): Question | undefined {
    return this.cellsFor(rowKey).find((cell) => cell.name === columnName);
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
    const total = this.#totals.find((candidate) => candidate.column === columnName);
    const kind = total?.kind;
    if (kind === undefined) {
      return undefined;
    }
    // Visible rows only: a total is something the respondent is being shown, and one
    // that counted answers to questions nobody can see would not add up on the screen.
    return summarise(
      kind,
      this.visibleRowKeys.map((rowKey) => this.getCellValue(rowKey, columnName)),
    );
  }

  /** The figure as the respondent reads it, formatted by the total's own template. */
  totalText(columnName: string): string {
    const total = this.#totals.find((candidate) => candidate.column === columnName);
    return total?.display(this.totalFor(columnName)) ?? '';
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
      for (const cell of this.cellsFor(rowKey)) {
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
    if (property !== 'columns') {
      super.addChild(property, child);
      return;
    }
    if (!(child instanceof Question)) {
      throw new Error(`columns accepts questions; received "${child.type}".`);
    }
    this.#columns.push(child);
  }
}
