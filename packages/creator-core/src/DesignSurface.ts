import { EventEmitter, isLocalizedText, parseSurvey } from '@kajay/core';
import type {
  Diagnostic,
  MetadataRegistry,
  Page,
  PageElement,
  Survey,
  SurveyDefinition,
  SurveyElement,
} from '@kajay/core';

/** The one place a title is written, so the key it lands under is decided once. */
const DEFAULT_LOCALE_KEY = 'default';

export interface DesignSurfaceOptions {
  readonly definition: SurveyDefinition;
  readonly registry?: MetadataRegistry;
}

/**
 * The survey being designed, and what is selected in it — checklist K3.
 *
 * A real `Survey` from `@kajay/core`, parsed through the same `parseSurvey` a respondent's
 * would be. That is what makes the design surface WYSIWYG rather than a drawing of one:
 * the thing on screen *is* the model, so a question type the Creator has never heard of
 * renders correctly and its logic runs.
 *
 * The survey is put in **design mode**, so every question reports itself read-only and
 * a click cannot record an answer at all. Answers could not have reached the definition
 * anyway — `serializeSurvey` writes the definition and `data` is the response, separate
 * since E6 — but a control that moved under the pointer would still be telling a
 * designer something false about what they had just done.
 *
 * Every mutation goes through {@link change}, which is the chokepoint K6's undo stack
 * will wrap. Scattered setters would mean finding them all later, and missing one.
 */
export class DesignSurface {
  readonly #survey: Survey;
  readonly #diagnostics: readonly Diagnostic[];
  #selected: SurveyElement | undefined;
  #version = 0;

  readonly onChanged: EventEmitter<number> = new EventEmitter();

  constructor(options: DesignSurfaceOptions) {
    const parsed = parseSurvey(options.definition, options.registry);
    this.#survey = parsed.survey;
    this.#diagnostics = parsed.diagnostics;
    // A survey on a canvas is being built, not answered. Design mode is runtime state
    // rather than the `readOnly` property, so opening a definition in the Creator does
    // not stamp it with a flag the author never wrote.
    this.#survey.setDesignMode(true);
  }

  get survey(): Survey {
    return this.#survey;
  }

  /** What was wrong with the definition it was given. Never thrown away silently. */
  get diagnostics(): readonly Diagnostic[] {
    return this.#diagnostics;
  }

  /**
   * Advances on every change, so a view can snapshot it.
   *
   * The same shape the toolbox uses and for the same reason: what a view actually reads
   * — the selection, the element list — is rebuilt per read, and a subscriber comparing
   * snapshots by identity would never settle.
   */
  get version(): number {
    return this.#version;
  }

  /** The page a designer is looking at. K4 adds the means to change it. */
  get page(): Page | undefined {
    return this.#survey.currentPage;
  }

  get selected(): SurveyElement | undefined {
    return this.#selected;
  }

  isSelected(element: SurveyElement): boolean {
    return this.#selected === element;
  }

  select(element: SurveyElement): void {
    this.#setSelected(element);
  }

  /**
   * Selects nothing.
   *
   * Its own method rather than `select(undefined)`: clearing a selection is a thing a
   * designer does deliberately — clicking the background — and reads as one at the call
   * site, where `undefined` reads as a value somebody forgot to compute.
   */
  clearSelection(): void {
    this.#setSelected();
  }

  #setSelected(element?: SurveyElement): void {
    if (this.#selected === element) {
      return;
    }
    this.#selected = element;
    this.#announce();
  }

  /**
   * Renames an element — checklist K3's inline title editing.
   *
   * **A localized title is edited in place, not replaced.** A title authored as
   * `{ default: 'Name', fr: 'Nom' }` is written back with only the current locale's
   * entry changed; overwriting it with a plain string would drop every other language
   * the moment somebody fixed a typo, and nothing about typing in a text box suggests
   * that is what happened. Which entry counts as current is the survey's locale (J1),
   * or `default` when it names none.
   */
  setTitle(element: PageElement | Page, title: string): void {
    const current = element.getPropertyValue('title');
    if (isLocalizedText(current)) {
      const key = this.#survey.locale.length > 0 ? this.#survey.locale : DEFAULT_LOCALE_KEY;
      this.change(() => {
        element.setPropertyValue('title', { ...current, [key]: title });
      });
      return;
    }
    this.change(() => {
      element.setPropertyValue('title', title);
    });
  }

  /**
   * Runs an edit and tells everyone.
   *
   * Public because a host — and, in K5 and K6, the Creator itself — will have edits this
   * class does not name, and the alternative is either a method per operation or a
   * mutation nobody hears about. What matters is that *every* change comes through here.
   */
  change(edit: () => void): void {
    edit();
    this.#announce();
  }

  #announce(): void {
    this.#version += 1;
    this.onChanged.emit(this.#version);
  }
}
