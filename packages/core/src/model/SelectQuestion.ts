import type { PropertyValue } from '../metadata/PropertyDescriptor.js';
import type { ChoicePager } from './ChoicePager.js';
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
  #paging: ChoicePager | undefined;

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

  /**
   * Serialization must write the definition, never what a runtime source supplied.
   *
   * Anything that is not `choices` goes to the base, which is what keeps a select
   * question's inherited `validators` collection working — an override that answered
   * for every property would quietly swallow it.
   */
  override getChildren(property: string): readonly SurveyElement[] {
    return property === 'choices' ? this.#choices : super.getChildren(property);
  }

  override addChild(property: string, child: SurveyElement): void {
    if (property !== 'choices') {
      super.addChild(property, child);
      return;
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
    return this.getNumberProperty('colCount');
  }

  get showOtherItem(): boolean {
    return this.getBooleanProperty('showOtherItem');
  }

  get otherText(): string {
    return this.getStringProperty('otherText');
  }

  get showNoneItem(): boolean {
    return this.getBooleanProperty('showNoneItem');
  }

  get noneText(): string {
    return this.getStringProperty('noneText');
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
    return this.getStringProperty('choicesFromQuestionMode');
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
    return this.getBooleanProperty('searchEnabled');
  }

  /** Whether the list arrives a page at a time from the host's loader. */
  get choicesLazyLoadEnabled(): boolean {
    return this.getBooleanProperty('choicesLazyLoadEnabled');
  }

  /** How many choices one page asks for. */
  get choicesLazyLoadPageSize(): number {
    return this.getNumberProperty('choicesLazyLoadPageSize');
  }

  /** Installs whatever is paging this question's choices. */
  attachChoicePaging(paging: ChoicePager): void {
    this.#paging = paging;
  }

  /** Forgets it. The question holds whatever choices were loaded, and asks for no more. */
  detachChoicePaging(): void {
    this.#paging = undefined;
  }

  /** True when the list arrives in pages, so what is here is not all there is. */
  get isPaged(): boolean {
    return this.#paging !== undefined;
  }

  /** True while a page is on its way. */
  get isLoadingChoices(): boolean {
    return this.#paging?.isLoading ?? false;
  }

  /**
   * True while there are more choices to ask for.
   *
   * False for an ordinary list, which is all there in one piece — so a renderer can ask
   * this of any select question and draw nothing when there is nothing more to fetch.
   */
  get hasMoreChoices(): boolean {
    return this.#paging?.hasMore ?? false;
  }

  /** Asks for the next page. Does nothing unless the list is paged. */
  loadMoreChoices(): void {
    this.#paging?.loadMore();
  }

  /** What the loaded choices were narrowed by, or empty. */
  get choiceFilter(): string {
    return this.#paging?.filter ?? '';
  }

  /**
   * Narrows the list.
   *
   * On a paged list this goes to the host, because the choices that would match may
   * never have been loaded — narrowing what is here would search one page of a
   * thousand. On an ordinary list it does nothing: everything is already present, and
   * `filterChoices` answers without a round trip.
   */
  setChoiceFilter(query: string): void {
    this.#paging?.setFilter(query);
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
    // A paged list was already narrowed where the data is. Filtering again here would
    // hide choices the host deliberately returned — a fuzzy server-side match, say —
    // and would still never find the ones that have not arrived.
    if (trimmed.length === 0 || !this.searchEnabled || this.isPaged) {
      return this.visibleChoices;
    }
    return this.visibleChoices.filter((choice) => choice.text.toLowerCase().includes(trimmed));
  }

  /** True when `choiceValue` is part of the current answer. */
  abstract isSelected(choiceValue: PropertyValue): boolean;

  /** Applies a respondent's click on a choice. */
  abstract select(choiceValue: PropertyValue): void;

  /** Replaces the answer from an adapter that reports its whole current selection. */
  abstract applySelection(choiceValues: readonly PropertyValue[]): void;
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
