import { valuesAreEqual } from '../expressions/expressionValues.js';
import type { PropertyValue } from '../metadata/PropertyDescriptor.js';
import { ItemValue } from './ItemValue.js';
import { Question } from './Question.js';
import type { SurveyElement } from './SurveyElement.js';

/** How each step on the scale is drawn. */
export type RateType = 'labels' | 'stars' | 'smileys';

/** Whether the scale is laid out in full or collapsed into a list. */
export type RatingDisplayMode = 'auto' | 'buttons' | 'dropdown';

/**
 * Beyond this many steps, `auto` collapses to a dropdown.
 *
 * A row of eleven buttons stops being scannable and starts being a wall, and on a
 * phone it wraps into something nobody can aim at. Eleven is the boundary because
 * 0–10 is the one long scale people genuinely use.
 */
const AUTO_DROPDOWN_THRESHOLD = 11;

/**
 * A point on a scale.
 *
 * Deliberately not a `SelectQuestion`. It looks like one — pick one of several — but a
 * rating's options are generated from a numeric range far more often than they are
 * authored, and none of `choicesByUrl`, carry-forward, `showNoneItem` or `showOtherItem`
 * means anything on a scale. Inheriting them to reuse a list would put a dozen
 * properties on the type that an author has to be told to ignore.
 */
export class RatingQuestion extends Question {
  /** Picking is answering: there is nothing else for the respondent to add. */
  override get answersInOneStep(): boolean {
    return true;
  }

  readonly #rateValues: ItemValue[] = [];

  override get type(): string {
    return 'rating';
  }

  get rateMin(): number {
    return this.getNumberProperty('rateMin');
  }

  get rateMax(): number {
    return this.getNumberProperty('rateMax');
  }

  /** Distance between steps. A non-positive step is treated as one. */
  get rateStep(): number {
    const step = this.getNumberProperty('rateStep');
    return step > 0 ? step : 1;
  }

  get rateType(): RateType {
    const declared = this.getStringProperty('rateType');
    return declared === 'stars' || declared === 'smileys' ? declared : 'labels';
  }

  get displayMode(): RatingDisplayMode {
    const declared = this.getStringProperty('displayMode');
    return declared === 'buttons' || declared === 'dropdown' ? declared : 'auto';
  }

  /** Text under the lowest step — "Not at all likely". */
  get minRateDescription(): string {
    return this.getStringProperty('minRateDescription');
  }

  get maxRateDescription(): string {
    return this.getStringProperty('maxRateDescription');
  }

  /** The scale as written in the definition. Serialization reads this. */
  get authoredRateValues(): readonly ItemValue[] {
    return this.#rateValues;
  }

  /**
   * The scale in play: the authored steps, or the numeric range when none were given.
   *
   * Generated rather than expanded into the definition on load, so `rateMin`/`rateMax`
   * stay the source of truth and an author editing them in the Creator does not have to
   * also delete eleven rows that were quietly written for them.
   */
  get rateValues(): readonly ItemValue[] {
    if (this.#rateValues.length > 0) {
      return this.#rateValues;
    }
    const steps: ItemValue[] = [];
    for (let value = this.rateMin; value <= this.rateMax; value += this.rateStep) {
      steps.push(createStep(value));
    }
    return steps;
  }

  /** What a renderer should actually draw, once `auto` has decided. */
  get effectiveDisplayMode(): 'buttons' | 'dropdown' {
    const declared = this.displayMode;
    if (declared !== 'auto') {
      return declared;
    }
    return this.rateValues.length >= AUTO_DROPDOWN_THRESHOLD ? 'dropdown' : 'buttons';
  }

  isSelected(value: PropertyValue): boolean {
    return this.value !== undefined && valuesAreEqual(this.value, value);
  }

  /** Picking the step that is already chosen clears it, which is the only way back. */
  select(value: PropertyValue): void {
    this.value = this.isSelected(value) ? undefined : value;
  }

  /** How far along the scale a step sits, 1-based. Zero when it is not on the scale. */
  positionOf(value: PropertyValue): number {
    return this.rateValues.findIndex((step) => valuesAreEqual(step.value, value)) + 1;
  }

  /**
   * How far along the scale the current answer sits. Zero when unanswered.
   *
   * A star scale fills every step up to the chosen one, which needs a position rather
   * than a value — and a renderer should not have to narrow `unknown` to ask.
   */
  get selectedPosition(): number {
    const value = this.value;
    return value === null || value === undefined
      ? 0
      : this.rateValues.findIndex((step) => valuesAreEqual(step.value, value)) + 1;
  }

  override getChildren(property: string): readonly SurveyElement[] {
    return property === 'rateValues' ? this.#rateValues : super.getChildren(property);
  }

  override addChild(property: string, child: SurveyElement): void {
    if (property !== 'rateValues') {
      super.addChild(property, child);
      return;
    }
    if (!(child instanceof ItemValue)) {
      throw new Error(`rateValues accepts choice items; received "${child.type}".`);
    }
    this.#rateValues.push(child);
  }
}

/**
 * Builds one generated step.
 *
 * A real `ItemValue` so a renderer treats generated and authored steps identically, but
 * not in `rateValues`, so it never serializes — the definition records the range, not
 * eleven rows somebody could edit into disagreeing with it.
 */
function createStep(value: number): ItemValue {
  const step = new ItemValue();
  step.value = value;
  return step;
}
