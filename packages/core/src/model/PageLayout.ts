import { collectVisibleQuestions } from './pageElements.js';
import { Page } from './Page.js';

/** How a definition's pages are presented to the respondent. */
export type QuestionsOnPageMode = 'standard' | 'singlePage' | 'questionPerPage';

export function toQuestionsOnPageMode(value: string): QuestionsOnPageMode {
  return value === 'singlePage' || value === 'questionPerPage' ? value : 'standard';
}

/**
 * The pages a respondent actually walks through.
 *
 * `questionsOnPageMode` is a *presentation* choice, so it reshapes what navigation and
 * the renderer see while leaving the authored `pages` untouched — the definition still
 * round-trips exactly as written, and switching modes never edits a document.
 *
 * Synthetic pages are built fresh, but only when something they depend on has actually
 * changed. That matters more than it looks: the React adapter keys on page identity, so
 * handing back a new array on every read would remount every question on every render.
 */
export class PageLayout {
  readonly #source: () => readonly Page[];
  readonly #mode: () => QuestionsOnPageMode;
  #signature = '';
  #pages: readonly Page[] = [];

  constructor(source: () => readonly Page[], mode: () => QuestionsOnPageMode) {
    this.#source = source;
    this.#mode = mode;
  }

  get pages(): readonly Page[] {
    const visible = this.#source().filter((page) => page.isVisible);
    const mode = this.#mode();
    const signature = describe(mode, visible);
    if (signature !== this.#signature) {
      this.#signature = signature;
      this.#pages = build(mode, visible);
    }
    return this.#pages;
  }
}

/**
 * What the layout depends on, as a string.
 *
 * Structural rather than a version counter: the layout changes when a page or question
 * appears, disappears or is reordered, and a counter that also ticks for unrelated
 * state would rebuild — and remount — for no reason.
 */
function describe(mode: QuestionsOnPageMode, visible: readonly Page[]): string {
  return [
    mode,
    ...visible.map(
      (page) =>
        `${page.name}(${collectVisibleQuestions(page.elements)
          .map((question) => question.name)
          .join(',')})`,
    ),
  ].join('|');
}

function build(mode: QuestionsOnPageMode, visible: readonly Page[]): readonly Page[] {
  if (mode === 'singlePage') {
    return visible.length === 0 ? [] : [mergeIntoOnePage(visible)];
  }
  if (mode === 'questionPerPage') {
    return visible
      .flatMap((page) => collectVisibleQuestions(page.elements))
      .map((question) => onePagePer(question));
  }
  return visible;
}

/**
 * Collapses every visible page into one.
 *
 * Panels are kept rather than flattened: they are how the author grouped the content,
 * and one long page is exactly where that grouping earns its keep.
 */
function mergeIntoOnePage(visible: readonly Page[]): Page {
  const merged = new Page();
  merged.name = visible.map((page) => page.name).join('+');
  const [first] = visible;
  if (visible.length === 1 && first !== undefined) {
    merged.title = first.title;
  }
  for (const page of visible) {
    for (const element of page.visibleElements) {
      merged.addChild('elements', element);
    }
  }
  return merged;
}

/**
 * Wraps one question in a page of its own.
 *
 * Panels are flattened here, unavoidably: a mode that shows one question at a time has
 * nowhere to put a group. The panel's own `visibleIf` still decides whether the
 * question is reachable, because the walk that found it honoured every level.
 */
function onePagePer(question: Page['elements'][number]): Page {
  const page = new Page();
  page.name = question.name;
  page.addChild('elements', question);
  return page;
}
