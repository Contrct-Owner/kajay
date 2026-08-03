import { valuesAreEqual } from '../expressions/expressionValues.js';
import type { PropertyValue } from '../metadata/PropertyDescriptor.js';
import type { ItemValue } from './ItemValue.js';
import { moveWithin } from './moveWithin.js';
import { SelectQuestion } from './SelectQuestion.js';

/** Whether the pool and the ranking sit side by side or one above the other. */
export type RankAreasLayout = 'horizontal' | 'vertical';

/**
 * Choices put in order rather than picked.
 *
 * The answer is an **ordered array of choice values**, so `{priorities[0]}` is "their
 * first choice" — position carries the meaning, which is the entire point of the type.
 *
 * Two shapes, one class. By default every choice is in the ranking and the respondent
 * only rearranges them. With `selectToRankEnabled` there are two areas: a pool of
 * choices nobody has placed, and the ranking itself, and only what has been placed is
 * part of the answer. That is a difference in which choices are ranked, not in what
 * ranking means, so it is a property rather than a second type — the same reasoning
 * that keeps `imagepicker` one type across both arities.
 */
export class RankingQuestion extends SelectQuestion {
  override get type(): string {
    return 'ranking';
  }

  get selectToRankEnabled(): boolean {
    return this.getBooleanProperty('selectToRankEnabled');
  }

  get selectToRankAreasLayout(): RankAreasLayout {
    return this.getStringProperty('selectToRankAreasLayout') === 'horizontal'
      ? 'horizontal'
      : 'vertical';
  }

  /** How many choices may be ranked at once. 0 means no limit. */
  get maxSelectedChoices(): number {
    return this.getNumberProperty('maxSelectedChoices');
  }

  /**
   * A ranking has no "none" and no "other".
   *
   * Both are answers *about* a list rather than positions in one, and offering either
   * as a rankable row would let a respondent record "None is my second choice". The
   * authored properties still round-trip — serialization reads the property bag, not
   * these getters — they simply do not reach `visibleChoices`.
   */
  override get showNoneItem(): boolean {
    return false;
  }

  override get showOtherItem(): boolean {
    return false;
  }

  /**
   * The answer: choice values, best first.
   *
   * Derived from the stored answer rather than returned raw, so a value that is no
   * longer offered — a choice hidden by its own `visibleIf`, or a carried-forward list
   * that changed — cannot linger in a position. The stored answer is left alone; if the
   * choice comes back, so does its rank.
   */
  get rankedValues(): readonly PropertyValue[] {
    return this.rankedChoices.map((choice) => choice.value);
  }

  /** The ranked choices themselves, in rank order. */
  get rankedChoices(): readonly ItemValue[] {
    const placed = this.#placedChoices();
    if (this.selectToRankEnabled) {
      return placed;
    }
    // Plain ranking ranks everything: a choice the answer does not mention has not been
    // moved yet, and belongs where the author put it.
    return [...placed, ...this.#unplacedChoices()];
  }

  /**
   * Choices waiting to be ranked.
   *
   * Always empty without `selectToRankEnabled`, because there is nowhere for a choice
   * to wait: the ranking is the whole list.
   */
  get unrankedChoices(): readonly ItemValue[] {
    return this.selectToRankEnabled ? this.#unplacedChoices() : [];
  }

  /** 1-based position, or 0 when the choice is not ranked. */
  rankOf(choiceValue: PropertyValue): number {
    return this.rankedValues.findIndex((value) => valuesAreEqual(value, choiceValue)) + 1;
  }

  override isSelected(choiceValue: PropertyValue): boolean {
    return this.rankOf(choiceValue) > 0;
  }

  /**
   * A click on a choice.
   *
   * Meaningful only in select-to-rank mode, where it moves a choice between the pool
   * and the end of the ranking. Plain ranking has nothing for a click to do — every
   * choice is already ranked, and the answer changes by moving rows, not by picking
   * them.
   */
  override select(choiceValue: PropertyValue): void {
    if (this.isSelected(choiceValue)) {
      this.unrank(choiceValue);
    } else {
      this.rank(choiceValue);
    }
  }

  /**
   * Records a complete order, as an adapter that rebuilds the whole list reports it.
   *
   * Unknown values are dropped and repeats ignored: an answer that ranked a choice
   * twice, or ranked something not on offer, is not a ranking.
   */
  override applySelection(choiceValues: readonly PropertyValue[]): void {
    const offered = this.#rankableChoices();
    const ordered = choiceValues.filter(
      (value, index) =>
        offered.some((choice) => valuesAreEqual(choice.value, value)) &&
        choiceValues.findIndex((candidate) => valuesAreEqual(candidate, value)) === index,
    );
    this.#write(this.#withinLimit(ordered));
  }

  /**
   * Moves the choice ranked at `from` to position `to`, both 0-based.
   *
   * The single call the reorder interaction makes, whatever drove it — a pointer drag,
   * an arrow key, or the Creator's own reorder later. Positions rather than values
   * because that is what an interaction knows: it watched a row travel past its
   * neighbours, and never needed to know which choice was on it.
   */
  moveRanked(from: number, to: number): boolean {
    const current = this.rankedValues;
    const next = moveWithin(current, from, to);
    if (next === current) {
      return false;
    }
    this.#write(next);
    return true;
  }

  /**
   * Places a pool choice into the ranking, at the end unless a position is given.
   *
   * Refuses silently once `maxSelectedChoices` is reached, on the same reasoning as a
   * multi-select's limit: dropping an earlier choice the respondent deliberately made,
   * to make room for a later one, is the wrong repair.
   */
  rank(choiceValue: PropertyValue, index?: number): void {
    if (!this.selectToRankEnabled || this.isSelected(choiceValue)) {
      return;
    }
    if (!this.#rankableChoices().some((choice) => valuesAreEqual(choice.value, choiceValue))) {
      return;
    }
    const current = this.rankedValues;
    const max = this.maxSelectedChoices;
    if (max > 0 && current.length >= max) {
      return;
    }
    const at = index === undefined ? current.length : clamp(index, 0, current.length);
    this.#write([...current.slice(0, at), choiceValue, ...current.slice(at)]);
  }

  /** Returns a ranked choice to the pool. Everything below it moves up. */
  unrank(choiceValue: PropertyValue): void {
    if (!this.selectToRankEnabled) {
      return;
    }
    this.#write(this.rankedValues.filter((value) => !valuesAreEqual(value, choiceValue)));
  }

  /** Choices this question can rank, in display order. */
  #rankableChoices(): readonly ItemValue[] {
    return this.visibleChoices;
  }

  /** Offered choices the answer names, in the answer's order. */
  #placedChoices(): readonly ItemValue[] {
    const offered = this.#rankableChoices();
    return this.#answer().flatMap((value) => {
      const choice = offered.find((candidate) => valuesAreEqual(candidate.value, value));
      return choice === undefined ? [] : [choice];
    });
  }

  /** Offered choices the answer does not name. */
  #unplacedChoices(): readonly ItemValue[] {
    const answer = this.#answer();
    return this.#rankableChoices().filter(
      (choice) => !answer.some((value) => valuesAreEqual(value, choice.value)),
    );
  }

  #answer(): readonly unknown[] {
    return Array.isArray(this.value) ? (this.value as unknown[]) : [];
  }

  #withinLimit(values: readonly PropertyValue[]): readonly PropertyValue[] {
    const max = this.maxSelectedChoices;
    return max > 0 && this.selectToRankEnabled ? values.slice(0, max) : values;
  }

  /**
   * Writes the answer.
   *
   * An empty ranking is *no answer*, not an empty array, so `isRequired` and every
   * expression that asks `notempty` agree with each other. That is also why an
   * untouched plain ranking records nothing: the order it is presented in is the
   * author's, and treating it as agreement would put an opinion in the data that
   * nobody expressed. An author who means the presented order to be an acceptable
   * answer says so with `defaultValue`.
   */
  #write(values: readonly PropertyValue[]): void {
    this.value = values.length === 0 ? undefined : [...values];
  }
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}
