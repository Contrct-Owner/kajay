import { EventEmitter, isLocalizedText, parseSurvey, serializeSurvey } from '@kajay/core';
import type {
  Diagnostic,
  MetadataRegistry,
  Page,
  PageElement,
  Survey,
  SurveyDefinition,
  SurveyElement,
} from '@kajay/core';
import { elementsOf } from './definitionTree.js';
import { applyPlacement, canPlace, dropSlotsFor } from './placement.js';
import type { DropSlot, PlacementSource } from './placement.js';

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
  readonly #registry: MetadataRegistry | undefined;
  #survey: Survey;
  #diagnostics: readonly Diagnostic[];
  #selected: SurveyElement | undefined;
  #version = 0;

  readonly onChanged: EventEmitter<number> = new EventEmitter();

  constructor(options: DesignSurfaceOptions) {
    this.#registry = options.registry;
    const parsed = this.#parse(options.definition);
    this.#survey = parsed.survey;
    this.#diagnostics = parsed.diagnostics;
  }

  #parse(definition: SurveyDefinition): { survey: Survey; diagnostics: readonly Diagnostic[] } {
    const parsed = parseSurvey(definition, this.#registry);
    // A survey on a canvas is being built, not answered. Design mode is runtime state
    // rather than the `readOnly` property, so opening a definition in the Creator does
    // not stamp it with a flag the author never wrote.
    parsed.survey.setDesignMode(true);
    return parsed;
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

  /** The canonical JSON of what is on the canvas right now — ADR-0002's round trip. */
  get definition(): SurveyDefinition {
    return serializeSurvey(this.#survey, this.#registry);
  }

  /** Every position a drop could land in on the page being designed — checklist K2. */
  get slots(): readonly DropSlot[] {
    const page = this.page;
    return page === undefined ? [] : dropSlotsFor(page.name, page.elements.length);
  }

  /** Whether this placement would change anything. What a drop indicator is drawn from. */
  canPlace(source: PlacementSource, slot: DropSlot): boolean {
    return canPlace(this.definition, source, slot);
  }

  /**
   * Puts a new element, or an existing one, at a slot — checklist K2.
   *
   * **The whole survey is re-parsed** ([ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md)
   * decision 3). Creating an element correctly means a name nothing else has taken, a
   * value host, layout and a place in the logic graph, and that is what `parseSurvey`
   * does — assembling one by hand against a live model is how the Creator learns to
   * build surveys the parser would never produce.
   *
   * Returns whether anything happened, so a caller can leave a refused drop unspoken.
   */
  place(source: PlacementSource, slot: DropSlot): boolean {
    const before = this.definition;
    const after = applyPlacement(before, source, slot);
    if (after === before) {
      return false;
    }
    this.#reparse(after, placedName(source, after, slot));
    return true;
  }

  /**
   * Swaps in a survey parsed from an edited definition.
   *
   * Nothing survives a re-parse by identity, so what is *about* the survey rather than
   * in it has to be carried across by name: the page being looked at, and what should
   * be selected once the dust settles. Losing either would mean a drop that scrolled
   * the designer back to page one with nothing selected — the edit landing correctly
   * and the canvas losing its place.
   */
  #reparse(definition: SurveyDefinition, selectedName: string | undefined): void {
    const pageName = this.page?.name;
    const parsed = this.#parse(definition);
    this.#survey = parsed.survey;
    this.#diagnostics = parsed.diagnostics;
    if (pageName !== undefined) {
      this.#survey.goTo(pageName);
    }
    this.#selected = this.page?.elements.find((element) => element.name === selectedName);
    this.#announce();
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

/**
 * What to select once the placement has landed.
 *
 * The thing that was just placed, in both cases. A designer who drops a question wants
 * to name it next, and one who moves a question has not stopped working on it — leaving
 * the selection where it was would make the very next keystroke edit the wrong element.
 *
 * A new element's name is read back out of the edited definition rather than predicted,
 * because {@link applyPlacement} is what decides it.
 */
function placedName(
  source: PlacementSource,
  after: SurveyDefinition,
  slot: DropSlot,
): string | undefined {
  if (source.kind === 'move') {
    return source.element;
  }
  const placed = elementsOf(after, slot.container)?.[slot.index];
  const name = placed?.['name'];
  return typeof name === 'string' ? name : undefined;
}

