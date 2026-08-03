import type { PathSegment } from '../expressions/ExpressionNode.js';
import { scopeReferences } from '../expressions/scopeReferences.js';
import { isEmptyValue } from '../expressions/expressionValues.js';
import type { MetadataRegistry } from '../metadata/MetadataRegistry.js';
import { copyElement } from './copyElement.js';
import { collectElements } from './pageElements.js';
import { PageElement } from './PageElement.js';
import { Panel } from './Panel.js';
import { Question } from './Question.js';
import type { SurveyElement } from './SurveyElement.js';
import type { ValueHost } from './ValueHost.js';

/** How a matrix lays itself out: as a table, as a list, or by the screen it is on. */
export type MatrixLayout = 'table' | 'list' | 'auto';

const LAYOUTS: ReadonlySet<string> = new Set(['table', 'list', 'auto']);

/** Anything unrecognised means `auto`, which is the behaviour nobody has to ask for. */
export function toMatrixLayout(value: string): MatrixLayout {
  return LAYOUTS.has(value) ? (value as MatrixLayout) : 'auto';
}

/** The scope name a column's own conditions use to talk about the row they are in. */
export const ROW_SCOPE = 'row';

/** What a matrix needs from outside itself to build cells. */
export interface CellAttachment {
  /** Builds the cell questions. Installed by `parseSurvey`, which owns the registry. */
  readonly registry: MetadataRegistry;
  /**
   * Called when rows appear or disappear, so conditional rules can be registered for
   * the cells that now exist. A cell's condition is an ordinary graph node, and a row
   * added after the graph was built would otherwise carry rules nobody registered.
   */
  readonly onRowsChanged: () => void;
  /**
   * Evaluates an expression with the `row` scope filled in.
   *
   * Only totals need it — a cell's own expressions are rewritten into real paths and
   * run as graph rules — and a total is not an answer, so there is nothing for the
   * graph to hang a rule on.
   */
  readonly evaluate: (expression: string, scope: Readonly<Record<string, unknown>>) => unknown;
}

/**
 * Reads and writes one cell's answer as if it were a question's own.
 *
 * This is the whole trick: a cell question is an ordinary question that happens to be
 * pointed at a slot inside another question's answer, so `TextQuestion`, every
 * validator and every renderer work inside a matrix unchanged.
 */
export class CellValueHost implements ValueHost {
  readonly #owner: Question;
  readonly #read: (column: string) => unknown;
  readonly #write: (column: string, value: unknown) => void;

  constructor(
    owner: Question,
    read: (column: string) => unknown,
    write: (column: string, value: unknown) => void,
  ) {
    this.#owner = owner;
    this.#read = read;
    this.#write = write;
  }

  getValue(name: string): unknown {
    return this.#read(name);
  }

  setValue(name: string, value: unknown): void {
    this.#write(name, value);
  }

  /** A read-only matrix is a read-only cell: the state belongs to the whole table. */
  get isReadOnly(): boolean {
    return this.#owner.isReadOnly;
  }
}

/** Which record an instance belongs to, and how its expressions should read it. */
export interface RowContext {
  readonly key: string;
  readonly title: string;
  readonly path: readonly PathSegment[];
  /** The word the templates use for "this record": `row`, `panel`. */
  readonly scope: string;
}

/**
 * Builds one instance of a template, for one record.
 *
 * The template's expressions are rewritten from the record's point of view as the copy
 * is made, so `{row.price}` becomes a real path into this row's answers. They are
 * rewritten **on the instance**, never on the template, which is what keeps the
 * definition saying what the author wrote — instances are not serialized.
 *
 * A matrix nested inside a template gets the same attachment, or its own cells would
 * have no registry to be built from: `parseSurvey` can only reach the questions on a
 * page, and this one was created long afterwards.
 */
export function buildInstance(
  template: PageElement,
  row: RowContext,
  attachment: CellAttachment,
): PageElement {
  const instance = copyElement(template, attachment.registry);
  if (!(instance instanceof PageElement)) {
    throw new TypeError(`A template must be a page element; "${template.type}" is not.`);
  }
  if (instance instanceof Question) {
    // The instance is named for its record *and* its own name, because that is the
    // question being asked — "Documentation, Quality" — and because every renderer
    // builds its label out of the title. A cell titled only "Quality" would give four
    // identical labels in a four-row table, and one with no title at all would give an
    // input nobody can name. Hiding it on screen is a theme's business; saying it is not.
    instance.setPropertyValue('title', `${row.title} ${template.title}`.trim());
    // Unique per instance, so the ids a renderer builds are unique too — see
    // `instanceKey`.
    instance.setInstanceKey(`${row.key}.${template.name}`);
  }
  scopeElementTree(instance, attachment.registry, row.scope, row.path);
  for (const nested of nestedRepeaters(instance)) {
    nested.attachCells(attachment);
  }
  return instance;
}

/** Every repeating question inside a built instance, itself included. */
function nestedRepeaters(instance: PageElement): readonly RepeatingHost[] {
  const elements = instance instanceof Panel ? [instance, ...collectElements(instance.elements)] : [instance];
  return elements.filter((element): element is PageElement & RepeatingHost => 'attachCells' in element);
}

/** What a nested repeating question needs from the one that built it. */
interface RepeatingHost {
  attachCells: (attachment: CellAttachment) => void;
}

/**
 * Rewrites every expression in an element and its children into the row's scope.
 *
 * *Every* one, not just the conditions: a computed cell's `expression`, a
 * `defaultValueExpression`, a `setValueIf`, and the `expression` of a validator hanging
 * off the column all talk about `{row.price}` and all have to mean the same thing.
 *
 * Which properties those are is the registry's answer (`isExpression`), so a property
 * added later is covered by declaring itself rather than by being remembered here.
 * Children are walked because a column's validators are elements of their own.
 */
function scopeElementTree(
  element: SurveyElement,
  registry: MetadataRegistry,
  scope: string,
  rowPath: readonly PathSegment[],
): void {
  for (const descriptor of registry.getProperties(element.type)) {
    if (!descriptor.isExpression) {
      continue;
    }
    const expression = element.getPropertyValue(descriptor.name);
    if (typeof expression === 'string' && expression.length > 0) {
      element.setPropertyValue(descriptor.name, scopeReferences(expression, scope, rowPath));
    }
  }
  for (const collection of registry.getChildCollections(element.type)) {
    for (const child of element.getChildren(collection.property)) {
      scopeElementTree(child, registry, scope, rowPath);
    }
  }
}

/** How a column's answers are summarised under the table. */
export type TotalKind = 'sum' | 'count' | 'min' | 'max' | 'avg';

const TOTAL_KINDS: ReadonlySet<string> = new Set(['sum', 'count', 'min', 'max', 'avg']);

export function toTotalKind(value: string): TotalKind | undefined {
  return TOTAL_KINDS.has(value) ? (value as TotalKind) : undefined;
}

/**
 * Summarises one column.
 *
 * Only what is numeric takes part, and `count` counts answers rather than rows — a
 * column nobody filled in totals to nothing, not to zero, because zero is an answer and
 * "nothing yet" is not. An empty column returns undefined for the same reason: printing
 * `0` under a column with no answers states a result nobody produced.
 */
export function summarise(kind: TotalKind, values: readonly unknown[]): number | undefined {
  const answered = values.filter((value) => !isEmptyValue(value));
  if (kind === 'count') {
    return answered.length;
  }
  const numbers = answered.map(Number).filter((value) => !Number.isNaN(value));
  if (numbers.length === 0) {
    return undefined;
  }
  switch (kind) {
    case 'sum':
      return numbers.reduce((total, value) => total + value, 0);
    case 'min':
      return Math.min(...numbers);
    case 'max':
      return Math.max(...numbers);
    default:
      return numbers.reduce((total, value) => total + value, 0) / numbers.length;
  }
}
