import type { PathSegment } from '../expressions/ExpressionNode.js';
import { scopeReferences } from '../expressions/scopeReferences.js';
import { isEmptyValue } from '../expressions/expressionValues.js';
import type { MetadataRegistry } from '../metadata/MetadataRegistry.js';
import { copyElement } from './copyElement.js';
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

/**
 * Builds one cell from its column.
 *
 * The column's conditions are rewritten from the row's point of view as the copy is
 * made, so `{row.price}` becomes a real path into this row's answers. They are rewritten
 * **on the cell**, never on the column, which is what keeps the definition saying what
 * the author wrote — cells are not serialized.
 */
export function buildCell(
  column: Question,
  row: { readonly key: string; readonly title: string; readonly path: readonly PathSegment[] },
  attachment: CellAttachment,
): Question {
  const cell = copyElement(column, attachment.registry);
  if (!(cell instanceof Question)) {
    throw new TypeError(`A matrix column must be a question; "${column.type}" is not.`);
  }
  // The cell is named for its row *and* its column, because that is the question the
  // cell is asking — "Documentation, Quality" — and because every renderer builds its
  // label out of the title. A cell titled only "Quality" would give four identical
  // labels in a four-row table, and one with no title at all would give an input nobody
  // can name. Hiding it on screen is a theme's business; saying it is not.
  cell.setPropertyValue('title', `${row.title} ${column.title}`.trim());
  // Unique per cell, so the ids a renderer builds are unique too — see `instanceKey`.
  cell.setInstanceKey(`${row.key}.${column.name}`);
  scopeElementTree(cell, attachment.registry, row.path);
  return cell;
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
  rowPath: readonly PathSegment[],
): void {
  for (const descriptor of registry.getProperties(element.type)) {
    if (!descriptor.isExpression) {
      continue;
    }
    const expression = element.getPropertyValue(descriptor.name);
    if (typeof expression === 'string' && expression.length > 0) {
      element.setPropertyValue(descriptor.name, scopeReferences(expression, ROW_SCOPE, rowPath));
    }
  }
  for (const collection of registry.getChildCollections(element.type)) {
    for (const child of element.getChildren(collection.property)) {
      scopeElementTree(child, registry, rowPath);
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
