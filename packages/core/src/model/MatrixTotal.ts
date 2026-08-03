import { SurveyElement } from './SurveyElement.js';
import type { TotalKind } from './matrixCells.js';
import { toTotalKind } from './matrixCells.js';

/**
 * A figure shown under one column of a matrix.
 *
 * Declared on the **matrix**, naming the column, rather than on the column itself — a
 * deliberate departure from SurveyJS, which puts `totalType` on the column. Our columns
 * *are* questions ([ADR-0001](../../../../docs/adr/0001-own-definition-format.md) lets
 * the format be ours), and a question has no business declaring a table footer: putting
 * it there would mean adding a matrix-only property to the question base, where it would
 * appear on every text field in every property grid forever.
 */
export class MatrixTotal extends SurveyElement {
  override get type(): string {
    return 'matrixtotal';
  }

  /** The column this summarises, by name. */
  get column(): string {
    return this.getStringProperty('column');
  }

  /** `sum`, `count`, `min`, `max` or `avg`. Anything else summarises nothing. */
  get kind(): TotalKind | undefined {
    return toTotalKind(this.getStringProperty('kind'));
  }

  /** Template around the figure, with `{0}` standing for it. */
  get format(): string {
    return this.getStringProperty('format');
  }

  /** How many decimal places the figure is shown to. */
  get precision(): number {
    return this.getNumberProperty('precision');
  }

  /**
   * The figure as the respondent reads it, or empty when there is nothing to show.
   *
   * Formatting lives here rather than in a renderer so every adapter prints a total
   * identically, and so the rule is testable without a DOM — the same reasoning that
   * put choice filtering in the model.
   */
  display(value: number | undefined): string {
    if (value === undefined) {
      return '';
    }
    const text = value.toFixed(this.precision);
    return this.format.length > 0 ? this.format.replaceAll('{0}', text) : text;
  }
}
