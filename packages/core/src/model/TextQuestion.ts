import { compareValues, toNumber } from '../expressions/expressionValues.js';
import type { PropertyValue } from '../metadata/PropertyDescriptor.js';
import { Question } from './Question.js';
import type { SurveyError } from './SurveyError.js';
import type { ValidationContext } from './Validator.js';

/**
 * Input types a text question understands.
 *
 * The list is closed because each one is a promise about what `data` will hold and
 * what the bounds below mean — `number` stores a number and compares numerically,
 * `date` stores an ISO day string and compares as text, which for ISO dates is the
 * same as chronologically. An unknown value falls back to `text` rather than reaching
 * the DOM unchecked.
 */
export type TextInputType =
  | 'text'
  | 'number'
  | 'email'
  | 'date'
  | 'datetime-local'
  | 'time'
  | 'tel'
  | 'url'
  | 'color'
  | 'range'
  | 'password';

const INPUT_TYPES: ReadonlySet<string> = new Set([
  'text',
  'number',
  'email',
  'date',
  'datetime-local',
  'time',
  'tel',
  'url',
  'color',
  'range',
  'password',
]);

/** The types whose answer is a number rather than a string. */
const NUMERIC_INPUT_TYPES: ReadonlySet<string> = new Set(['number', 'range']);

/** A single-line answer, in whichever of the browser's input flavours suits it. */
export class TextQuestion extends Question {
  override get type(): string {
    return 'text';
  }

  get inputType(): TextInputType {
    const declared = this.getStringProperty('inputType');
    return INPUT_TYPES.has(declared) ? (declared as TextInputType) : 'text';
  }

  set inputType(value: TextInputType) {
    this.setPropertyValue('inputType', value);
  }

  get placeholder(): string {
    return this.getStringProperty('placeholder');
  }

  set placeholder(value: string) {
    this.setPropertyValue('placeholder', value);
  }

  /** True when the answer is stored as a number rather than as text. */
  get isNumeric(): boolean {
    return NUMERIC_INPUT_TYPES.has(this.inputType);
  }

  /** Lower bound. A number for numeric types, an ISO string for the date ones. */
  get min(): PropertyValue | undefined {
    return this.hasPropertyValue('min') ? this.getResolvedProperty('min') : undefined;
  }

  get max(): PropertyValue | undefined {
    return this.hasPropertyValue('max') ? this.getResolvedProperty('max') : undefined;
  }

  /** Granularity for numeric and date inputs. Zero means the browser decides. */
  get step(): number {
    return this.getNumberProperty('step');
  }

  /**
   * Records what a text input reported.
   *
   * Coercion belongs here rather than in an adapter: a `number` input hands back a
   * string like every other input, and a survey whose answer type depended on which
   * renderer was mounted would be a survey whose expressions worked in React and not
   * elsewhere. An empty numeric field clears the answer rather than storing `""`,
   * because `""` is not a number and `data` should not claim otherwise.
   */
  setInputValue(raw: string): void {
    if (!this.isNumeric) {
      this.value = raw;
      return;
    }
    this.value = raw.length === 0 ? undefined : (toNumber(raw) ?? raw);
  }

  /**
   * The bounds, checked as part of the question rather than by an authored validator.
   *
   * `min`/`max` are attributes the browser also enforces, but the form is rendered
   * `noValidate` — the engine owns the message so every adapter says the same thing,
   * and so a host that never mounts a browser input still gets the check.
   */
  override checkValue({ value }: ValidationContext): readonly SurveyError[] {
    const errors: SurveyError[] = [];
    const { min, max } = this;
    if (min !== undefined && belowBound(value, min)) {
      errors.push({ kind: 'min', text: boundMessage(this.isNumeric, 'least', min) });
    }
    if (max !== undefined && aboveBound(value, max)) {
      errors.push({ kind: 'max', text: boundMessage(this.isNumeric, 'most', max) });
    }
    return errors;
  }
}

/** "no less than 5" for a number, "no earlier than 2026-01-01" for a date. */
function boundMessage(isNumeric: boolean, end: 'least' | 'most', bound: PropertyValue): string {
  const comparison = isNumeric
    ? (end === 'least' ? 'no less than' : 'no greater than')
    : (end === 'least' ? 'no earlier than' : 'no later than');
  return `Please enter a value ${comparison} ${String(bound)}.`;
}

/**
 * Ordering that works for both flavours of bound.
 *
 * `compareValues` compares numerically when both sides are numeric and as text
 * otherwise — which for the ISO strings the date inputs produce is chronological.
 * Values it cannot order at all are left alone: a bound nobody can evaluate is not a
 * bound the respondent failed.
 */
function belowBound(value: unknown, bound: PropertyValue): boolean {
  return (compareValues(value, bound) ?? 0) < 0;
}

function aboveBound(value: unknown, bound: PropertyValue): boolean {
  return (compareValues(value, bound) ?? 0) > 0;
}
