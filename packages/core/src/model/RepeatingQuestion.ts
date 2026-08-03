import type { PathSegment } from '../expressions/ExpressionNode.js';
import type { CellAttachment } from './matrixCells.js';
import { buildInstance, CellValueHost } from './matrixCells.js';
import { asAnswerRecord, withAnswerEntry } from './objectAnswers.js';
import type { PageElement } from './PageElement.js';
import { collectElements, collectQuestions, collectVisibleQuestions } from './pageElements.js';
import { Question } from './Question.js';
import type { ConditionalItemGroup } from './Question.js';
import type { SurveyError } from './SurveyError.js';
import { collectAnswerErrors } from './validateAnswer.js';
import type { ValidationContext } from './Validator.js';

/** Separates a row from what is in it, in an error's path: `docs.price`, `2.amount`. */
const PATH_SEPARATOR = '.';

/**
 * A question whose answer is a collection of records, each holding its own questions.
 *
 * This is the shape a matrix of cells and a dynamic panel both have, and it is why they
 * are one piece of machinery rather than two: a row of a table and an instance of a
 * repeating panel differ in how they are *drawn* and in almost nothing else. Both hold
 * template elements, build a real question per template per record, point each at its
 * slot in that record, rewrite the templates' expressions into a local scope, and check
 * the lot.
 *
 * What a subclass decides: where the records come from, what the local scope word is
 * (`row`, `panel`), and which template collections it has.
 *
 * The alternative was a second copy of the builder, the validation pass and the scope
 * rewriting — the same "quietly diverging implementation" argument that made cells real
 * questions in the first place.
 */
export abstract class RepeatingQuestion extends Question {
  readonly #instances: Map<string, Map<string, readonly PageElement[]>> = new Map();
  #attachment: CellAttachment | undefined;

  /** Installed by `parseSurvey`, which owns the registry instances are built from. */
  attachCells(attachment: CellAttachment): void {
    this.#attachment = attachment;
    this.#instances.clear();
  }

  protected get attachment(): CellAttachment | undefined {
    return this.#attachment;
  }

  /**
   * The word a template's expressions use for the record they are in.
   *
   * `row` in a matrix, `panel` in a repeating panel. It is the author's word for "this
   * one", and it differs only because the two read differently in a definition.
   */
  protected abstract get scopeName(): string;

  /** Every record that exists, as the key its answers are stored under. */
  abstract get rowKeys(): readonly string[];

  /**
   * Whether a record is currently shown. Every one by default; a fixed matrix asks the row.
   *
   * Instances are built for *every* record rather than the visible ones, because their
   * conditions are registered as graph rules when the tree is walked — and one that was
   * hidden at that moment would come back later carrying rules nobody registered.
   */
  isRowVisible(_rowKey: string): boolean {
    return true;
  }

  /** The records a respondent can currently see and answer. */
  get visibleRowKeys(): readonly string[] {
    return this.rowKeys.filter((rowKey) => this.isRowVisible(rowKey));
  }

  /** What the record's header reads. */
  abstract rowTitle(rowKey: string): string;

  /** Where this record's answers live, as an expression path. */
  protected abstract rowPath(rowKey: string): readonly PathSegment[];

  /**
   * Where one question's answer lives inside a record, as an expression path.
   *
   * Public because the logic engine declares it: a cell's `defaultValueExpression` or
   * computed `expression` is an ordinary rule, and a rule has to tell the graph what it
   * writes or nothing can be ordered after it.
   */
  cellPath(rowKey: string, columnName: string): readonly PathSegment[] {
    return [...this.rowPath(rowKey), { kind: 'name', name: columnName }];
  }

  /** This record's answers, as one object. */
  protected abstract readRow(rowKey: string): Readonly<Record<string, unknown>>;

  /** Replaces this record's answers. `undefined` removes its entry entirely. */
  protected abstract writeRow(rowKey: string, next: Record<string, unknown> | undefined): void;

  /**
   * One record's instances of a group of templates, built once and kept.
   *
   * Stable identity matters as much as the values: a renderer keys rows by it, focus
   * lives in it, and rebuilding on every read would lose both on every keystroke.
   *
   * Grouped because a matrix has two sets of templates — its columns and its detail —
   * and they are drawn in different places while sharing one record.
   */
  protected instancesOf(
    group: string,
    rowKey: string,
    templates: readonly PageElement[],
  ): readonly PageElement[] {
    const cache = this.#groupCache(group);
    const existing = cache.get(rowKey);
    if (existing !== undefined) {
      return existing;
    }
    const attachment = this.#attachment;
    if (attachment === undefined) {
      // Nothing has supplied a registry, so nothing can be built. Empty rather than
      // thrown: a model assembled by hand is still a legal model, and it renders as an
      // empty table rather than taking the page down.
      return [];
    }
    const host = new CellValueHost(
      this,
      (name) => this.readRow(rowKey)[name],
      (name, value) => {
        this.#writeCell(rowKey, name, value);
      },
    );
    const row = {
      key: rowKey,
      title: this.rowTitle(rowKey),
      path: this.rowPath(rowKey),
      scope: this.scopeName,
    };
    const built = templates.map((template) => {
      const instance = buildInstance(template, row, attachment);
      instance.attachValueHost(host);
      return instance;
    });
    cache.set(rowKey, built);
    return built;
  }

  #groupCache(group: string): Map<string, readonly PageElement[]> {
    const existing = this.#instances.get(group);
    if (existing !== undefined) {
      return existing;
    }
    const created = new Map<string, readonly PageElement[]>();
    this.#instances.set(group, created);
    return created;
  }

  /** The elements built for one record, as they were authored: containers not flattened. */
  protected abstract rowInstances(rowKey: string): readonly PageElement[];

  /** The questions of one record, in the order they are asked. */
  rowCells(rowKey: string): readonly Question[] {
    return collectQuestions(this.rowInstances(rowKey));
  }

  /** Every question of every record, in record order. */
  get allCells(): readonly Question[] {
    return this.rowKeys.flatMap((rowKey) => this.rowCells(rowKey));
  }

  /**
   * Every element of every record: what carries a condition, not just what holds an
   * answer.
   *
   * Containers included, because a group inside a template carries a `visibleIf` of its
   * own and is not a question — walking only the questions would leave that condition
   * registered nowhere and the group permanently visible.
   */
  get allElements(): readonly PageElement[] {
    return this.rowKeys.flatMap((rowKey) => collectElements(this.rowInstances(rowKey)));
  }

  /** One question of one record, by name. */
  cellAt(rowKey: string, columnName: string): Question | undefined {
    return this.rowCells(rowKey).find((cell) => cell.name === columnName);
  }

  getCellValue(rowKey: string, columnName: string): unknown {
    return this.readRow(rowKey)[columnName];
  }

  /**
   * Takes one answer back out of a record.
   *
   * It leaves the record rather than being stored as a blank, and the last one to go
   * takes the record with it — the same rule at both levels, so a question nobody
   * answered is `undefined` rather than a collection of empty objects.
   */
  clearCell(rowKey: string, columnName: string): void {
    const { [columnName]: _cleared, ...rest } = this.readRow(rowKey);
    this.writeRow(rowKey, Object.keys(rest).length > 0 ? rest : undefined);
  }

  /**
   * Throws every instance away, so the next read builds them again.
   *
   * Public because a locale switch needs it (J1) and is not a change to the records:
   * an instance's title is composed from the template's *resolved* one, so the strings
   * inside it are the only translated text the model keeps.
   */
  rebuildInstances(): void {
    this.invalidateCells();
  }

  /** Forgets what was built, so the next read builds it for the records there are now. */
  protected invalidateCells(): void {
    this.#instances.clear();
    this.#attachment?.onRowsChanged();
  }

  #writeCell(rowKey: string, columnName: string, value: unknown): void {
    this.writeRow(rowKey, withAnswerEntry(this.readRow(rowKey), columnName, value));
  }

  /** The instances carry the conditions; the templates never do — they never render. */
  override get conditionalItems(): readonly ConditionalItemGroup[] {
    return [{ key: 'cell', items: this.allElements }];
  }

  /** An untouched collection still owes whatever the questions in it demand. */
  override get checksEmptyAnswer(): boolean {
    return true;
  }

  /**
   * Every question's own verdict, reported twice on purpose.
   *
   * On the question, so its renderer draws the message beside the input exactly as it
   * would anywhere else; and returned with a `record.question` path, so the survey knows
   * the collection is not answered and a host reading `errors` sees the whole picture.
   * Both are produced in the same pass, so they cannot disagree.
   *
   * A hidden question is not checked, for the reason a hidden question never is: an
   * error the respondent cannot see is one they cannot act on.
   */
  override checkValue(context: ValidationContext): readonly SurveyError[] {
    const errors: SurveyError[] = [];
    for (const rowKey of this.visibleRowKeys) {
      // Reachability, not the question's own flag: a question inside a hidden *group*
      // is out of reach however visible it is itself, which is the rule a page has
      // always applied and which an instance had been getting wrong. The demo found it —
      // a required question inside a conditional group blocked a survey nobody could see
      // it in.
      const reachable = new Set(collectVisibleQuestions(this.rowInstances(rowKey)));
      for (const cell of this.rowCells(rowKey)) {
        const own = reachable.has(cell) ? collectAnswerErrors(cell, context.evaluate) : [];
        cell.setErrors(own);
        for (const error of own) {
          errors.push(Object.assign({}, error, { path: `${rowKey}${PATH_SEPARATOR}${cell.name}` }));
        }
      }
    }
    return errors;
  }

  /**
   * Clearing this question's errors clears the ones inside it.
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
}
