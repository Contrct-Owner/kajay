import { valuesAreEqual } from '../expressions/expressionValues.js';
import type { LogicRule } from '../logic/LogicRule.js';
import type { ChoiceFetcher } from './ChoiceFetcher.js';
import type { ChoicePageLoader } from './ChoicePageLoader.js';
import { ChoicePager } from './ChoicePager.js';
import type { Endpoints } from './endpoints.js';
import type { ItemValue } from './ItemValue.js';
import { choiceListsMatch } from './ItemValue.js';
import { SelectQuestion } from './SelectQuestion.js';
import type { SurveyLogicHost } from './SurveyLogicHost.js';
import { UrlChoiceLoader } from './UrlChoiceLoader.js';

const DEFAULT_PAGE_SIZE = 25;

/** How a carried-forward list relates to the source question's answer. */
export type CarryForwardMode = 'all' | 'selected' | 'unselected';

export interface CarryForwardChoiceSource {
  readonly key: string;
  readonly question: SelectQuestion;
  readonly sourceName: string;
  readonly mode: CarryForwardMode;
  /** Choices currently offered by the source, or undefined when it is not a select. */
  readonly getSourceChoices: () => readonly ItemValue[] | undefined;
  readonly getSourceValue: () => unknown;
  readonly announce: () => void;
}

function selectedValues(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value === null || value === undefined ? [] : [value];
}

/**
 * Owns every way a question's choices can come from somewhere other than its own
 * authored list: carried forward from another question, or loaded from a URL.
 *
 * Both live here so the two look alike at the call site and share one notion of which
 * source is installed. Fetching stays injected, so core remains I/O-free; everything
 * that makes an async source safe — request generations, response caching,
 * pending-request sharing, and error capture — is kept behind this one interface.
 */
export class ChoiceSourceController {
  readonly #errors: string[] = [];
  readonly #pagers: Map<string, ChoicePager> = new Map();
  readonly #urls: UrlChoiceLoader = new UrlChoiceLoader();
  #loadPage: ChoicePageLoader | undefined;

  setFetcher(fetchJson: ChoiceFetcher | undefined): void {
    this.#urls.setFetcher(fetchJson);
  }

  setPageLoader(loadPage: ChoicePageLoader | undefined): void {
    this.#loadPage = loadPage;
  }

  /** The origins `{@name}` resolves against. Constant for the session by design. */
  setEndpoints(endpoints: Endpoints): void {
    this.#urls.setEndpoints(endpoints);
  }

  /** A failed load, malformed response, or URL configured without a fetcher. */
  get errors(): readonly string[] {
    return [...this.#urls.errors, ...this.#errors];
  }

  /** Makes every outstanding request for a removed URL source obsolete. */
  invalidate(key: string): void {
    this.#urls.invalidate(key);
  }

  /**
   * Installs the one dynamic source a select question declares.
   *
   * Source arbitration lives beside acquisition: carry-forward wins, then URL, then
   * paged loading. Rebuilding survey rules therefore cannot accidentally install two
   * providers or forget to detach the previous pager.
   */
  register(question: SelectQuestion, owner: string, host: SurveyLogicHost): void {
    const urlKey = `${owner}:choicesByUrl`;
    const hadDynamicChoices = question.hasDynamicChoices;
    question.clearChoiceProvider();

    const carryForward = optionalString(question.choicesFromQuestion);
    if (carryForward !== undefined) {
      this.#registerCarryForward(question, owner, carryForward, host);
      return;
    }

    const url = optionalString(question.choicesByUrl);
    if (url !== undefined) {
      this.#registerUrl(question, urlKey, url, host);
      return;
    }

    this.invalidate(urlKey);
    if (question.choicesLazyLoadEnabled) {
      this.#attachPager(question, () => {
        host.announceChoices(question);
      });
      return;
    }

    this.#detachPager(question);
    if (hadDynamicChoices) {
      host.announceChoices(question);
    }
  }

  #registerCarryForward(
    question: SelectQuestion,
    owner: string,
    sourceName: string,
    host: SurveyLogicHost,
  ): void {
    this.invalidate(`${owner}:choicesByUrl`);
    this.#detachPager(question);
    host.logic.addRule(
      this.createCarryForwardRule({
        key: `${owner}:choicesFromQuestion`,
        question,
        sourceName,
        mode: toCarryForwardMode(question.choicesFromQuestionMode),
        getSourceChoices: () => {
          const source = host.findQuestion(sourceName);
          return source instanceof SelectQuestion ? source.visibleChoices : undefined;
        },
        getSourceValue: () => host.resolveValue(sourceName),
        announce: () => {
          host.announceChoices(question);
        },
      }),
    );
  }

  #registerUrl(
    question: SelectQuestion,
    key: string,
    url: string,
    host: SurveyLogicHost,
  ): void {
    this.#detachPager(question);
    host.logic.addRule(
      this.#urls.createRule({
        key,
        question,
        url,
        resolvePlaceholder: (name) => host.resolveValue(name),
        announce: () => {
          host.announceChoices(question);
        },
      }),
    );
  }

  /**
   * Derives one question's choices from another's.
   *
   * The derivation is installed as a **live provider**, not computed into a stored
   * list. Two independent things move it: the source's *answer*, which this rule
   * depends on, and the visibility of individual source choices, which their own
   * `visibleIf` drives. A snapshot would be correct for the first and stale for the
   * second.
   *
   * The rule therefore exists only to notice when the derived list changed as a result
   * of the answer, and say so — choice-visibility changes already announce themselves
   * through the element-state event.
   */
  createCarryForwardRule(source: CarryForwardChoiceSource): LogicRule {
    let announced: readonly ItemValue[] | undefined;

    const derive = (): readonly ItemValue[] => {
      const choices = source.getSourceChoices();
      if (choices === undefined) {
        return [];
      }
      if (source.mode === 'all') {
        return choices;
      }
      const answer = selectedValues(source.getSourceValue());
      const isPicked = (choice: ItemValue): boolean =>
        answer.some((selected) => valuesAreEqual(selected, choice.value));
      return source.mode === 'selected'
        ? choices.filter((choice) => isPicked(choice))
        : choices.filter((choice) => !isPicked(choice));
    };

    return {
      key: source.key,
      reads: [[{ kind: 'name', name: source.sourceName }]],
      run: () => {
        // Pointing at a question that has no choices is an authoring mistake; leaving
        // the authored list in place beats offering nothing.
        if (source.getSourceChoices() === undefined) {
          return;
        }
        source.question.setChoiceProvider(derive);

        const current = derive();
        if (announced === undefined || !choiceListsMatch(announced, current)) {
          announced = current;
          source.announce();
        }
      },
    };
  }

  #attachPager(question: SelectQuestion, announce: () => void): void {
    const load = this.#loadPage;
    if (load === undefined) {
      this.#errors.push(
        `"${question.name}" loads its choices lazily, so the survey needs a page loader. Pass one as the loadChoicePage option.`,
      );
      return;
    }
    const existing = this.#pagers.get(question.name);
    if (existing !== undefined) {
      this.#installPager(question, existing);
      return;
    }

    const pager = new ChoicePager({
      questionName: question.name,
      pageSize:
        question.choicesLazyLoadPageSize > 0
          ? question.choicesLazyLoadPageSize
          : DEFAULT_PAGE_SIZE,
      load,
      announce,
      reportError: (message) => {
        this.#errors.push(`Loading choices for "${question.name}" failed: ${message}`);
      },
    });
    this.#pagers.set(question.name, pager);
    this.#installPager(question, pager);
    pager.loadMore();
  }

  #detachPager(question: SelectQuestion): void {
    if (this.#pagers.delete(question.name)) {
      question.detachChoicePaging();
      question.clearChoiceProvider();
    }
  }

  #installPager(question: SelectQuestion, pager: ChoicePager): void {
    question.setChoiceProvider(() => pager.items);
    question.attachChoicePaging(pager);
  }
}

function optionalString(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}

function toCarryForwardMode(mode: string): CarryForwardMode {
  return mode === 'selected' || mode === 'unselected' ? mode : 'all';
}
