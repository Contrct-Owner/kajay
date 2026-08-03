import { toNumber } from '../expressions/expressionValues.js';
import { Question } from './Question.js';

/** How a computed result is written out. */
export type DisplayStyle = 'none' | 'decimal' | 'currency' | 'percent' | 'date';

/**
 * The locale every computed value is formatted in, for now.
 *
 * Fixed rather than taken from the runtime, so the same definition produces the same
 * string on a developer's machine, in CI and on a respondent's phone — a survey whose
 * displayed total changed with the server's locale would be a support ticket nobody
 * could reproduce. Making it follow the survey locale is §J's job, and this constant
 * is where it will be replaced.
 */
const FORMAT_LOCALE = 'en-US';

/**
 * A read-only value computed from the answers.
 *
 * A `Question` and not a `DisplayElement`, unlike `html` and `image`: it genuinely
 * holds a value, that value reaches `data`, and expressions elsewhere can read it. The
 * respondent simply is not the one who supplies it.
 */
export class ExpressionQuestion extends Question {
  override get type(): string {
    return 'expression';
  }

  get expression(): string {
    return this.getStringProperty('expression');
  }

  get displayStyle(): DisplayStyle {
    const declared = this.getStringProperty('displayStyle');
    const styles = ['decimal', 'currency', 'percent', 'date'];
    return styles.includes(declared) ? (declared as DisplayStyle) : 'none';
  }

  /** ISO 4217 code, used when `displayStyle` is `currency`. */
  get currency(): string {
    return this.getStringProperty('currency');
  }

  get maximumFractionDigits(): number {
    return this.getNumberProperty('maximumFractionDigits');
  }

  /**
   * A template around the formatted result, with `{0}` standing for it.
   *
   * Separate from `displayStyle` because "how a number is written" and "what sentence
   * it sits in" are different decisions, and an author who wants "Total: $40.00" should
   * not have to give up currency formatting to get the word "Total".
   */
  get format(): string {
    return this.getStringProperty('format');
  }

  /** What the respondent reads: the value, formatted, in its template. */
  get displayValue(): string {
    const value = this.value;
    if (value === null || value === undefined) {
      return '';
    }
    const formatted = this.#format(value);
    const template = this.format;
    return template.length > 0 ? template.replaceAll('{0}', formatted) : formatted;
  }

  #format(value: unknown): string {
    const style = this.displayStyle;
    if (style === 'date') {
      return formatDate(value);
    }
    const numeric = toNumber(value);
    if (style === 'none' || numeric === undefined) {
      return String(value);
    }
    return new Intl.NumberFormat(FORMAT_LOCALE, {
      style: style === 'decimal' ? 'decimal' : style,
      ...(style === 'currency' ? { currency: this.currency } : {}),
      ...(this.maximumFractionDigits > 0
        ? { maximumFractionDigits: this.maximumFractionDigits }
        : {}),
    }).format(numeric);
  }
}

/**
 * An ISO day, not a locale date.
 *
 * `toLocaleDateString` would introduce both a locale and a timezone into the output,
 * and a computed date that reads differently depending on where the browser thinks it
 * is is a bug that only shows up in another country.
 */
function formatDate(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : (date.toISOString().split('T')[0] ?? '');
}
