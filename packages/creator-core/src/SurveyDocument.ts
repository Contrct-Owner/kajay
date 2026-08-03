import { parseSurvey, serializeSurvey } from '@kajay/core';
import type {
  Diagnostic,
  MetadataRegistry,
  Page,
  Survey,
  SurveyDefinition,
} from '@kajay/core';

/**
 * The survey being designed, and how it is replaced.
 *
 * Its own concept because a structural edit *replaces* it
 * ([ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md) decision 3) rather than
 * mutating it, and everything that must survive that replacement — the selection, the
 * undo stacks — belongs to whatever is holding the document, not to the document.
 *
 * A real `Survey` from `@kajay/core`, parsed through the same `parseSurvey` a
 * respondent's would be. That is what makes the design surface WYSIWYG rather than a
 * drawing of one: the thing on screen *is* the model, so a question type the Creator has
 * never heard of renders correctly and its logic runs.
 */
export class SurveyDocument {
  readonly #registry: MetadataRegistry | undefined;
  #survey: Survey;
  #diagnostics: readonly Diagnostic[];

  constructor(definition: SurveyDefinition, registry?: MetadataRegistry) {
    this.#registry = registry;
    const parsed = this.#parse(definition);
    this.#survey = parsed.survey;
    this.#diagnostics = parsed.diagnostics;
  }

  get survey(): Survey {
    return this.#survey;
  }

  /** What was wrong with the definition it was given. Never thrown away silently. */
  get diagnostics(): readonly Diagnostic[] {
    return this.#diagnostics;
  }

  /** The canonical JSON of what is on the canvas right now — ADR-0002's round trip. */
  get definition(): SurveyDefinition {
    return serializeSurvey(this.#survey, this.#registry);
  }

  get page(): Page | undefined {
    return this.#survey.currentPage;
  }

  get pages(): readonly Page[] {
    return this.#survey.pages;
  }

  /**
   * Parses an edited definition and shows the named page.
   *
   * The page is restored here rather than left to the caller because a fresh parse
   * always starts on page one, and every caller wants that undone — an edit that
   * scrolled the designer back to the beginning would land correctly and lose the
   * canvas its place.
   */
  replace(definition: SurveyDefinition, goToPage: string | undefined): void {
    const parsed = this.#parse(definition);
    this.#survey = parsed.survey;
    this.#diagnostics = parsed.diagnostics;
    if (goToPage !== undefined) {
      this.#survey.goTo(goToPage);
    }
  }

  #parse(definition: SurveyDefinition): { survey: Survey; diagnostics: readonly Diagnostic[] } {
    const parsed = parseSurvey(definition, this.#registry);
    // A survey on a canvas is being built, not answered. Design mode is runtime state
    // rather than the `readOnly` property, so opening a definition in the Creator does
    // not stamp it with a flag the author never wrote — and it has to be set on *every*
    // parse, or the first structural edit would quietly make the canvas answerable.
    parsed.survey.setDesignMode(true);
    return parsed;
  }
}
