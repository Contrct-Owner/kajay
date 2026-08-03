import { EventEmitter, isLocalizedText } from '@kajay/core';
import type {
  Diagnostic,
  MetadataRegistry,
  Page,
  PageElement,
  Survey,
  SurveyDefinition,
  SurveyElement,
} from '@kajay/core';
import { nameOf } from './definitionTree.js';
import { SurveyDocument } from './SurveyDocument.js';
import { UndoHistory } from './UndoHistory.js';
import type { HistorySnapshot } from './UndoHistory.js';
import { addPageTo, placeOn, removePageFrom } from './designerEdits.js';
import { canPlace, dropSlotsFor } from './placement.js';
import type { DropSlot, PlacementSource } from './placement.js';

/** The one place a title is written, so the key it lands under is decided once. */
const DEFAULT_LOCALE_KEY = 'default';

/** What an edit wants restored once its definition has been parsed. */
export interface EditOptions {
  /** The element or page to select. Nothing, by default. */
  readonly select?: string | undefined;
  /** The page to show. The one already open, by default. */
  readonly goTo?: string | undefined;
  /** Edits sharing a key coalesce into one undo entry — see {@link UndoHistory}. */
  readonly undoKey?: string | undefined;
  /** The definition being replaced, when the caller has already computed it. */
  readonly from?: SurveyDefinition | undefined;
}

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
  readonly #document: SurveyDocument;
  #selected: SurveyElement | undefined;
  #version = 0;
  readonly #history: UndoHistory = new UndoHistory();

  readonly onChanged: EventEmitter<number> = new EventEmitter();

  constructor(options: DesignSurfaceOptions) {
    this.#document = new SurveyDocument(options.definition, options.registry);
  }

  get survey(): Survey {
    return this.#document.survey;
  }

  /** What was wrong with the definition it was given. Never thrown away silently. */
  get diagnostics(): readonly Diagnostic[] {
    return this.#document.diagnostics;
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

  /** The page a designer is looking at. {@link goToPage} changes it. */
  get page(): Page | undefined {
    return this.#document.page;
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
    // The designer's attention has moved. Without this, renaming a question, going away
    // and coming back to rename it again would be one undo, because the key had not
    // changed in between.
    this.#history.breakRun();
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
    // Every keystroke arrives here, and they coalesce into one undo entry (K6): giving
    // a rename back one letter at a time is not what anybody means by undoing it.
    const undoKey = `title:${element.name}`;
    if (isLocalizedText(current)) {
      const key = this.survey.locale.length > 0 ? this.survey.locale : DEFAULT_LOCALE_KEY;
      this.change(() => {
        element.setPropertyValue('title', { ...current, [key]: title });
      }, undoKey);
      return;
    }
    this.change(() => {
      element.setPropertyValue('title', title);
    }, undoKey);
  }

  /** The canonical JSON of what is on the canvas right now — ADR-0002's round trip. */
  get definition(): SurveyDefinition {
    return this.#document.definition;
  }

  /** Every position a drop could land in on the page being designed — checklist K2. */
  get slots(): readonly DropSlot[] {
    const page = this.page;
    return page === undefined
      ? []
      : dropSlotsFor({ of: 'elements', page: page.name }, page.elements.length);
  }

  /** Every position a page could be dragged to — checklist K4. */
  get pageSlots(): readonly DropSlot[] {
    return dropSlotsFor({ of: 'pages' }, this.pages.length);
  }

  /** The pages a designer can switch between. */
  get pages(): readonly Page[] {
    return this.#document.pages;
  }

  /**
   * Looks at another page — checklist K4.
   *
   * Announced, because which page is on the canvas is the largest thing a view draws and
   * nothing else would tell it. It goes through the survey's own `goTo` rather than a
   * second notion of "current", so the page a designer is editing and the page the model
   * thinks it is on cannot come apart.
   */
  goToPage(name: string): void {
    if (this.page?.name === name) {
      return;
    }
    // Navigating is not an edit, so it records nothing — but the designer's attention
    // has moved, so whatever was coalescing has ended.
    this.#history.breakRun();
    this.#document.replace(this.definition, name);
    this.#selected = undefined;
    this.#announce();
  }

  /** Adds an empty page at the end and moves to it — checklist K4. */
  addPage(): void {
    addPageTo(this);
  }

  /** Removes a page and everything on it — checklist K4. Says whether it was there. */
  removePage(name: string): boolean {
    return removePageFrom(this, name);
  }

  /** Puts a new element, or an existing one, at a slot — checklist K2 and K4. */
  place(source: PlacementSource, slot: DropSlot): boolean {
    return placeOn(this, source, slot);
  }

  /**
   * Swaps in an edited definition, remembering the state it replaced — K6.
   *
   * **The chokepoint for every structural edit**, and public because K5 and a host will
   * both have edits this class does not name. `change` is its counterpart for edits that
   * mutate the model in place; between them nothing reaches the survey unrecorded.
   *
   * The caller has already produced the new definition, which is
   * [ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md) decision 3 working as
   * intended: what an edit *means* is a pure function from one definition to another,
   * and this is only the part that cannot be pure.
   */
  applyEdit(definition: SurveyDefinition, options: EditOptions = {}): void {
    this.#record(options.from ?? this.definition, options.undoKey);
    this.#reparse(definition, options.select, options.goTo ?? this.page?.name);
  }

  /** Whether this placement would change anything. What a drop indicator is drawn from. */
  canPlace(source: PlacementSource, slot: DropSlot): boolean {
    return canPlace(this.definition, source, slot);
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
  #reparse(
    definition: SurveyDefinition,
    selectedName: string | undefined,
    goToPage: string | undefined,
  ): void {
    this.#document.replace(definition, goToPage);
    this.#selected = this.#resolve(selectedName);
    this.#announce();
  }

  /**
   * Finds what was selected in the survey that has just replaced the old one.
   *
   * Pages as well as elements, because a page is a selectable thing in its own right
   * (K4) — and a page dragged into a new order should still be the one selected when it
   * lands, exactly as a question is.
   */
  #resolve(name: string | undefined): SurveyElement | undefined {
    if (name === undefined) {
      return undefined;
    }
    return (
      this.page?.elements.find((element) => element.name === name) ??
      this.pages.find((page) => page.name === name)
    );
  }

  get canUndo(): boolean {
    return this.#history.canUndo;
  }

  get canRedo(): boolean {
    return this.#history.canRedo;
  }

  /**
   * Takes back the last edit — checklist K6.
   *
   * Returns whether there was one. Undo is a re-parse of a definition this class kept,
   * which is the return on [ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md)
   * decision 3: no operation has to know how to invert itself, so no future operation
   * can forget to.
   */
  undo(): boolean {
    return this.#travel(this.#history.undo(this.#snapshot()));
  }

  /** Puts back what {@link undo} took — checklist K6. */
  redo(): boolean {
    return this.#travel(this.#history.redo(this.#snapshot()));
  }

  #travel(snapshot: HistorySnapshot | undefined): boolean {
    if (snapshot === undefined) {
      return false;
    }
    this.#reparse(snapshot.definition, snapshot.selected, snapshot.page);
    return true;
  }

  /**
   * Remembers the state an edit is about to change.
   *
   * The definition is passed in rather than read, because every caller has just
   * computed it — serializing a whole survey twice per drop is a real cost for nothing.
   */
  #record(definition: SurveyDefinition, undoKey?: string): void {
    this.#history.record(this.#snapshot(definition), undoKey);
  }

  #snapshot(definition: SurveyDefinition = this.definition): HistorySnapshot {
    return {
      definition,
      page: this.page?.name,
      selected: nameOf({ name: this.#selected?.getPropertyValue('name') }),
    };
  }

  /**
   * Runs an edit and tells everyone.
   *
   * Public because a host — and, in K5 and K6, the Creator itself — will have edits this
   * class does not name, and the alternative is either a method per operation or a
   * mutation nobody hears about. What matters is that *every* change comes through here.
   */
  change(edit: () => void, undoKey?: string): void {
    this.#record(this.definition, undoKey);
    edit();
    this.#announce();
  }

  #announce(): void {
    this.#version += 1;
    this.onChanged.emit(this.#version);
  }
}


