import type { PropertyValue } from '../metadata/PropertyDescriptor.js';
import { ItemValue } from './ItemValue.js';
import { Question } from './Question.js';
import type { SurveyElement } from './SurveyElement.js';

/** Where the special choices sit relative to the authored ones. */
export const OTHER_VALUE = 'other';
export const NONE_VALUE = 'none';

/**
 * Base for questions answered by picking from a list.
 *
 * Holds the choice collection and the ordering, other and none options that every
 * select type shares. Selection *semantics* differ per type and live in the subclass.
 */
export abstract class SelectQuestion extends Question {
  readonly #choices: ItemValue[] = [];
  #choiceProvider: (() => readonly ItemValue[]) | undefined;

  /**
   * The choices in play: supplied at runtime if a source is active, else authored.
   *
   * Carry-forward and REST both replace the list rather than merging into it. Merging
   * would leave a question whose options came half from the definition and half from
   * elsewhere, which nobody could reason about.
   */
  get choices(): readonly ItemValue[] {
    return this.#choiceProvider?.() ?? this.#choices;
  }

  /** The list as written in the definition, whatever a runtime source has supplied. */
  get authoredChoices(): readonly ItemValue[] {
    return this.#choices;
  }

  get hasDynamicChoices(): boolean {
    return this.#choiceProvider !== undefined;
  }

  /**
   * Supplies choices from a runtime source.
   *
   * A provider rather than a stored array, because a carried-forward list has to stay
   * *live*: a source choice hidden by its own `visibleIf` must disappear here too, and
   * a snapshot taken when the source's answer changed would be stale by then.
   */
  setChoiceProvider(provider: () => readonly ItemValue[]): void {
    this.#choiceProvider = provider;
  }

  /** Falls back to the authored list. */
  clearChoiceProvider(): void {
    this.#choiceProvider = undefined;
  }

  /** Serialization must write the definition, never what a runtime source supplied. */
  override getChildren(property: string): readonly SurveyElement[] {
    return property === 'choices' ? this.#choices : [];
  }

  override addChild(property: string, child: SurveyElement): void {
    if (property !== 'choices') {
      throw new Error(`"${this.type}" does not accept children under "${property}".`);
    }
    if (!(child instanceof ItemValue)) {
      throw new Error(`choices accepts choice items; received "${child.type}".`);
    }
    this.#choices.push(child);
  }

  /** `none`, `asc` or `desc`. Unknown values leave the authored order alone. */
  get choicesOrder(): string {
    return this.getStringProperty('choicesOrder');
  }

  get colCount(): number {
    const colCount = this.getPropertyValue('colCount');
    return typeof colCount === 'number' ? colCount : 0;
  }

  get showOtherItem(): boolean {
    return this.getBooleanProperty('showOtherItem');
  }

  get otherText(): string {
    const text = this.getStringProperty('otherText');
    return text.length > 0 ? text : 'Other';
  }

  get showNoneItem(): boolean {
    return this.getBooleanProperty('showNoneItem');
  }

  get noneText(): string {
    const text = this.getStringProperty('noneText');
    return text.length > 0 ? text : 'None';
  }

  /**
   * Choices a respondent can currently pick, in display order.
   *
   * Ordering is applied here rather than by mutating the collection, so `choicesOrder`
   * never rewrites what the definition says.
   */
  get visibleChoices(): readonly ItemValue[] {
    // `this.choices`, not the authored list: a runtime source has to reach the
    // respondent, which is the entire point of having one.
    const visible = this.choices.filter((choice) => choice.isVisible);
    const ordered = this.#applyOrder(visible);
    const specials: ItemValue[] = [];
    if (this.showNoneItem) {
      specials.push(createSpecialChoice(NONE_VALUE, this.noneText));
    }
    if (this.showOtherItem) {
      specials.push(createSpecialChoice(OTHER_VALUE, this.otherText));
    }
    return [...ordered, ...specials];
  }

  #applyOrder(choices: readonly ItemValue[]): readonly ItemValue[] {
    const order = this.choicesOrder;
    if (order !== 'asc' && order !== 'desc') {
      return choices;
    }
    const sorted = choices.toSorted((left, right) => left.text.localeCompare(right.text));
    return order === 'asc' ? sorted : sorted.toReversed();
  }

  get choicesFromQuestion(): string {
    return this.getStringProperty('choicesFromQuestion');
  }

  get choicesFromQuestionMode(): string {
    const mode = this.getStringProperty('choicesFromQuestionMode');
    return mode.length > 0 ? mode : 'all';
  }

  get choicesByUrl(): string {
    return this.getStringProperty('choicesByUrl');
  }

  get choicesPath(): string {
    return this.getStringProperty('choicesPath');
  }

  get choicesValueName(): string {
    return this.getStringProperty('choicesValueName');
  }

  get choicesTitleName(): string {
    return this.getStringProperty('choicesTitleName');
  }

  /** Prompt shown while nothing is chosen. Meaningful for collapsed lists. */
  get placeholder(): string {
    return this.getStringProperty('placeholder');
  }

  /** Whether the respondent may narrow a long list by typing. Defaults to on. */
  get searchEnabled(): boolean {
    const enabled = this.getPropertyValue('searchEnabled');
    return typeof enabled === 'boolean' ? enabled : true;
  }

  /**
   * Choices matching a search term.
   *
   * Filtering lives here rather than in the renderer so every adapter narrows a list
   * identically, and so the rule is testable without a DOM. Matching is
   * case-insensitive against the display text, which is what the respondent sees.
   */
  filterChoices(query: string): readonly ItemValue[] {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length === 0 || !this.searchEnabled) {
      return this.visibleChoices;
    }
    return this.visibleChoices.filter((choice) => choice.text.toLowerCase().includes(trimmed));
  }

  /** True when `choiceValue` is part of the current answer. */
  abstract isSelected(choiceValue: PropertyValue): boolean;

  /** Applies a respondent's click on a choice. */
  abstract select(choiceValue: PropertyValue): void;
}

/**
 * Builds the synthetic `none` and `other` entries.
 *
 * They are real ItemValues so the renderer treats every entry identically, but they
 * are not in `choices` and therefore never serialize — the definition records
 * `showNoneItem`, not a none row someone could edit.
 */
function createSpecialChoice(value: string, text: string): ItemValue {
  const item = new ItemValue();
  item.value = value;
  item.text = text;
  return item;
}
