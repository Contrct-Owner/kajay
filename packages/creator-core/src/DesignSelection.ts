import type { Survey, SurveyElement } from '@kajay/core';

/**
 * What a designer is working on — checklists K3, K4 and L5.
 *
 * **Two kinds, not one**, and that is the whole reason this is a class rather than a
 * field. An element or a page is selected *by name*, because nothing survives a re-parse
 * by identity and a name is what an edit can hand back. The **survey** has no name — it is
 * the thing names are unique within — so it cannot be selected that way at all, and
 * inventing a reserved one would put a token into a channel that otherwise holds real
 * names and would eventually collide with a question called it.
 *
 * So the survey is a flag. That is not a compromise: the survey is always there, so
 * "the survey is selected" needs no resolving after a re-parse and cannot go stale.
 */
export class DesignSelection {
  #element: SurveyElement | undefined;
  #isSurvey = false;

  /**
   * What is selected, given the survey it is a selection *in*.
   *
   * The survey is passed rather than held, because a structural edit replaces it — the
   * same reason `SurveyDocument` exists at all.
   */
  in(survey: Survey): SurveyElement | undefined {
    return this.#isSurvey ? survey : this.#element;
  }

  /** Whether the survey itself is what is selected — checklist L5. */
  get isSurvey(): boolean {
    return this.#isSurvey;
  }

  /** The selected element's name, or `undefined` — including when it is the survey. */
  get name(): string | undefined {
    const name = this.#element?.getPropertyValue('name');
    return typeof name === 'string' ? name : undefined;
  }

  /** Selects an element or a page, or nothing. Says whether anything changed. */
  select(element?: SurveyElement): boolean {
    if (this.#element === element && !this.#isSurvey) {
      return false;
    }
    this.#element = element;
    this.#isSurvey = false;
    return true;
  }

  /** Selects the survey itself — checklist L5. Says whether anything changed. */
  selectSurvey(): boolean {
    if (this.#isSurvey) {
      return false;
    }
    this.#element = undefined;
    this.#isSurvey = true;
    return true;
  }

  /**
   * Puts the selection back after a re-parse, or after an undo.
   *
   * Named elements are found again in the survey that has just replaced the old one;
   * whether the *survey* was selected is simply stated, because there is nothing to look
   * for. Pages as well as elements, because a page is a selectable thing in its own right
   * (K4) — and a **nested** child deliberately is not, so a matrix column renamed from the
   * collection editor does not become the selection and empty the grid being typed in.
   */
  restore(
    name: string | undefined,
    pages: readonly PageLike[],
    current: PageLike | undefined,
    isSurvey = false,
  ): void {
    this.#isSurvey = isSurvey;
    this.#element =
      name === undefined
        ? undefined
        : ((current?.elements.find((element) => element.name === name) ??
            pages.find((page) => page.name === name)) as SurveyElement | undefined);
  }
}

/** The little of a page this needs: its name, and what is on it. */
interface PageLike {
  readonly name: string;
  readonly elements: readonly { readonly name: string }[];
}
