import { EventEmitter, ExpressionCache } from '@kajay/core';
import type {
  Diagnostic,
  MetadataRegistry,
  Page,
  PageElement,
  PropertyValue,
  Survey,
  SurveyDefinition,
  SurveyElement,
} from '@kajay/core';
import { locate } from './definitionTree.js';
import { SurveyDocument } from './SurveyDocument.js';
import { DesignHistory } from './DesignHistory.js';
import type { HistorySnapshot } from './UndoHistory.js';
import { addPageTo, placeOn, removePageFrom } from './designerEdits.js';
import { DesignSelection } from './DesignSelection.js';
import {
  convertibleTypes,
  convertIn,
  duplicateIn,
  removeElementFrom,
} from './elementEdits.js';
import type { DropSlot, PlacementSource } from './placement.js';
import { DesignClipboard } from './DesignClipboard.js';
import { collectionRowsFor } from './collectionGrid.js';
import type { CollectionRow } from './collectionGrid.js';
import {
  addChildTo,
  moveChildIn,
  removeChildFrom,
  setFastEntryIn,
} from './collectionEdits.js';
import { propertyRowsFor } from './propertyGrid.js';
import type { PropertyGridOptions } from './propertyGridOptions.js';
import type { PropertyGridCategory } from './propertyGrid.js';
import { renameIn, setLocalizedOn, setPropertyOn } from './propertyEdits.js';
import type { CreatorConfiguration } from './CreatorConfiguration.js';
import { refuse } from './EditRefusal.js';
import type { CreatorNotice } from './CreatorNotice.js';
import type { EditRefusal } from './EditRefusal.js';
import type { DesignSurfaceOptions, EditOptions } from './DesignSurfaceOptions.js';
import { PlacementSessionModel } from './PlacementSession.js';
import type { PlacementSession } from './PlacementSession.js';

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
  readonly #selection: DesignSelection = new DesignSelection();
  #version = 0;
  readonly #clipboard: DesignClipboard = new DesignClipboard();
  readonly #history: DesignHistory = new DesignHistory();
  readonly #configuration: CreatorConfiguration | undefined;
  readonly #placementSession: PlacementSessionModel;
  #placementRevision = 0;

  readonly onChanged: EventEmitter<number> = new EventEmitter();

  /**
   * What the Creator did that nobody asked for — ADR-0023's other half.
   *
   * **A stream rather than state**, and separate from `onChanged`: a notice is a thing that
   * happened once, not a property of the document, and a view that re-read it on every
   * render would announce a paste again every time something else changed. A host may
   * route these into their own notification system; the default assembly renders them into
   * a polite live region.
   */
  readonly onNotice: EventEmitter<CreatorNotice> = new EventEmitter();

  /**
   * Announces something the Creator did on its own initiative.
   *
   * Public for the reason `change` and `applyEdit` are: a host — and K5's own edits — will
   * do things this class does not name, and the alternative is an edit that quietly reshapes
   * a survey with nothing able to say so.
   */
  notify(what: CreatorNotice): void {
    this.onNotice.emit(what);
  }

  constructor(options: DesignSurfaceOptions) {
    this.#document = new SurveyDocument(options.definition, options.registry);
    this.#configuration = options.configuration;
    this.#placementSession = new PlacementSessionModel({
      definition: () => this.definition,
      revision: () => this.#placementRevision,
      pageName: () => this.page?.name,
      isContainerType: this.#isContainerType,
      isReadOnly: () => this.isReadOnly,
      configuration: () => this.configuration,
      commit: (definition, before, select) => this.#commitPlacement(definition, before, select),
    });
  }

  /** The headless source, preview, commit, abandon and narration lifecycle. */
  get placement(): PlacementSession { return this.#placementSession; }

  /** What this deployment has turned off — checklist N2. */
  get configuration(): CreatorConfiguration | undefined { return this.#configuration; }

  /**
   * Whether the survey can be changed at all — checklist N2.
   *
   * A read-only Creator is a **viewer**, not a hidden one: the canvas, the grid and the
   * JSON are all still there to read. A reviewer needs to see the logic to comment on it.
   */
  get isReadOnly(): boolean { return this.#configuration?.isReadOnly === true; }

  get survey(): Survey { return this.#document.survey; }

  /**
   * The registry this document was parsed with — checklist M4.
   *
   * Exposed because a session built *beside* the surface has to introspect the same types
   * it holds: a translation table walks child collections, and one asking a different
   * registry would miss a host's own type or find one this survey was never parsed with.
   */
  get registry(): MetadataRegistry { return this.#document.registry; }

  /** What was wrong with the definition it was given. Never thrown away silently. */
  get diagnostics(): readonly Diagnostic[] { return this.#document.diagnostics; }

  /**
   * Advances on every change, so a view can snapshot it.
   *
   * The same shape the toolbox uses and for the same reason: what a view actually reads
   * — the selection, the element list — is rebuilt per read, and a subscriber comparing
   * snapshots by identity would never settle.
   */
  get version(): number { return this.#version; }

  /** The page a designer is looking at. {@link goToPage} changes it. */
  get page(): Page | undefined { return this.#document.page; }

  get selected(): SurveyElement | undefined { return this.#selection.in(this.survey); }

  /**
   * The selection itself: what it is by name, and whether it is the survey — L5.
   *
   * Exposed rather than mirrored in two getters here, because "the survey is selected" and
   * "the selection is called `who`" are one fact with two shapes, and the survey having no
   * name is the reason it needs both — see {@link DesignSelection}.
   */
  get selection(): DesignSelection { return this.#selection; }

  isSelected(element: SurveyElement): boolean { return this.selected === element; }

  select(element: SurveyElement): void { this.#changeSelection(() => this.#selection.select(element)); }

  /**
   * Selects the survey itself — checklist L5.
   *
   * Its own method for {@link clearSelection}'s reason: it is a thing a designer does
   * deliberately, and `select(survey)` would be a call the type system allows and the
   * name-based restoration cannot honour.
   */
  selectSurvey(): void { this.#changeSelection(() => this.#selection.selectSurvey()); }

  /**
   * Selects nothing.
   *
   * Its own method rather than `select(undefined)`: clearing a selection is a thing a
   * designer does deliberately — clicking the background — and reads as one at the call
   * site, where `undefined` reads as a value somebody forgot to compute.
   */
  clearSelection(): void { this.#changeSelection(() => this.#selection.select()); }

  #changeSelection(apply: () => boolean): void {
    if (!apply()) {
      return;
    }
    // The designer's attention has moved. Without this, renaming a question, going away
    // and coming back to rename it again would be one undo, because the key had not
    // changed in between.
    this.#history.breakRun();
    this.#announce();
  }

  /**
   * Retitles an element — checklist K3's inline title editing.
   *
   * A named shortcut for {@link setProperty}, kept because the title is the one property
   * with an editor outside the grid and `setTitle(element, text)` reads better there than
   * a string constant would. Everything it used to do itself — the localized merge, the
   * coalescing undo key — now happens for *every* property, which is what stops
   * `description` and `placeholder` behaving differently from `title`.
   */
  setTitle(element: PageElement | Page, title: string): void { this.setProperty(element, 'title', title); }

  /**
   * Every property of an element, grouped and ordered — checklist L1.
   *
   * Asked of the surface rather than of the registry directly, so a view holds one object
   * and the registry a document was parsed with is the registry its grid is generated
   * from. The same shape as {@link convertibleTypes}, and for the same reason.
   */
  properties(element: SurveyElement, grid?: PropertyGridOptions): readonly PropertyGridCategory[] {
    return propertyRowsFor(element, this.#document.registry, this.#conditions, grid);
  }

  /**
   * Parsed property conditions, kept for the life of the surface — checklist L3.
   *
   * Owned rather than module-global, the rule `ExpressionCache` states for itself. The
   * grid is rebuilt on every keystroke of a property edit, and re-parsing a dozen
   * conditions each time would be work with a known answer.
   */
  readonly #conditions: ExpressionCache = new ExpressionCache();

  /**
   * Writes a property — checklist L1. Says whether it took.
   *
   * `name` goes through {@link rename} and every other property is set in place; see
   * [`propertyEdits`](./propertyEdits.ts) for why that split is not arbitrary.
   *
   * Returns **why it did not take**, or `undefined` when it did — ADR-0023. A boolean
   * could not be rendered, translated, or told apart from "nothing needed doing".
   */
  setProperty(
    element: SurveyElement,
    name: string,
    value: PropertyValue,
  ): EditRefusal | undefined {
    return setPropertyOn(this, element, name, value, this.#document.registry);
  }

  /**
   * Writes one language of a localizable property — checklist L2.
   *
   * {@link setProperty} edits whichever language the survey is being read in; this edits
   * any of them, which is what a translations panel needs and the whole of the
   * localizable-string editor.
   */
  setLocalized(
    element: SurveyElement,
    name: string,
    locale: string,
    text: string,
  ): EditRefusal | undefined {
    return setLocalizedOn(this, element, name, locale, text, this.#document.registry);
  }

  /** Renames an element or page and every reference to it — checklist L1. */
  rename(from: string, to: string): EditRefusal | undefined { return renameIn(this, from, to); }

  /**
   * The child collections an element holds, ready to edit — checklist L2.
   *
   * Choices, validators, matrix columns and rows, multiple-text items — one accessor,
   * because they are one thing as far as the registry is concerned. What a page holds is
   * not among them: the canvas owns that.
   */
  collections(element: SurveyElement, grid?: PropertyGridOptions): readonly CollectionRow[] {
    return collectionRowsFor(element, this.#document.registry, grid);
  }

  /**
   * Adds a child to one of an element's collections — checklist L2.
   *
   * The owner is the *element*, not its name, and that is the guard as much as the
   * convenience — see [`collectionEdits`](./collectionEdits.ts).
   */
  addChild(owner: SurveyElement, property: string, type: string): EditRefusal | undefined {
    return addChildTo(this, owner, property, type, this.#document.registry);
  }

  /** Removes the child at an index. Says whether there was one. */
  removeChild(owner: SurveyElement, property: string, index: number): EditRefusal | undefined {
    return removeChildFrom(this, owner, property, index, this.#document.registry);
  }

  /** Moves a child within its collection — checklist L2. */
  moveChild(
    owner: SurveyElement,
    property: string,
    from: number,
    to: number,
  ): EditRefusal | undefined {
    return moveChildIn(this, owner, property, from, to, this.#document.registry);
  }

  /** Rewrites a whole shorthand collection from text — checklist L2's fast entry. */
  setFastEntry(owner: SurveyElement, property: string, text: string): EditRefusal | undefined {
    return setFastEntryIn(this, owner, property, text, this.#document.registry);
  }

  /** The canonical JSON of what is on the canvas right now — ADR-0002's round trip. */
  get definition(): SurveyDefinition { return this.#document.definition; }

  /**
   * Whether an element is one a drop can land *inside* — checklist K2's nesting.
   *
   * Asked of the registry rather than of `type === 'panel'`, so a host's own container
   * type is a drop target with no registration — the same argument K1 made about the
   * toolbox, which lists nothing by name either.
   */
  isContainer(element: PageElement): boolean { return this.#isContainerType(element.type); }

  readonly #isContainerType = (type: string): boolean =>
    this.#document.registry.getChildCollection(type, 'elements') !== undefined;

  /** Where an element sits: which container holds it, and at what index. */
  locate(name: string): DropSlot | undefined { return locate(this.definition, name); }

  /** The pages a designer can switch between. */
  get pages(): readonly Page[] { return this.#document.pages; }

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
    const invalidated = this.#placementSession.invalidate();
    this.#history.breakRun();
    this.#document.replace(this.definition, name);
    this.#placementRevision += 1;
    this.#selection.select();
    this.#announce();
    this.#publishPlacement(invalidated);
  }

  /** Adds an empty page at the end and moves to it — checklist K4. */
  addPage(): void { addPageTo(this); }

  /** Removes a page and everything on it — checklist K4. Says whether it was there. */
  removePage(name: string): EditRefusal | undefined { return removePageFrom(this, name); }

  /** Puts a new element, or an existing one, at a slot — checklist K2 and K4. */
  place(source: PlacementSource, slot: DropSlot): EditRefusal | undefined {
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
  applyEdit(definition: SurveyDefinition, options: EditOptions = {}): EditRefusal | undefined {
    // **The read-only refusal is minted once, here and in `change`.** Every edit in the
    // package reaches the document through one of the two, so propagating what they return
    // gives N2's restriction a voice everywhere without a guard per method — and a new edit
    // added later inherits it by construction rather than by remembering (ADR-0023).
    if (this.isReadOnly) { return refuse('read-only'); }
    const invalidated = this.#placementSession.invalidate();
    this.#history.record(this, options.from ?? this.definition, options.undoKey);
    // An edit that names nothing to select leaves the selection where it was, which for
    // the survey (§L5) is the only way it *can* survive — it has no name to hand back.
    // One that names something means it, so the survey gives way.
    const keepSurvey = options.select === undefined && this.#selection.isSurvey;
    this.#reparse(definition, options.select, options.goTo ?? this.page?.name, keepSurvey);
    this.#publishPlacement(invalidated);
    return undefined;
  }

  /** Commits a placement after its final idle snapshot has already been installed. */
  #commitPlacement(
    definition: SurveyDefinition,
    before: SurveyDefinition,
    select: string | undefined,
  ): void {
    this.#history.record(this, before);
    this.#reparse(definition, select, this.page?.name);
  }

  /** Removes an element, and everything inside it — checklist K7. */
  removeElement(name: string): EditRefusal | undefined { return removeElementFrom(this, name); }

  /** Puts a copy of an element straight after it — checklist K5. */
  duplicate(name: string): EditRefusal | undefined { return duplicateIn(this, name); }

  /**
   * Remembers an element so it can be pasted — checklist K5.
   *
   * Announced but not recorded, and the difference is the point: copying changes what a
   * view *shows* — whether Paste is available — without changing the survey, so there is
   * nothing to undo and everything to redraw.
   */
  copy(name: string): EditRefusal | undefined {
    const refusal = this.#clipboard.copy(this, name);
    if (refusal !== undefined) {
      return refusal;
    }
    this.#announce();
    return undefined;
  }

  /** What was copied, if anything — see {@link DesignClipboard}. */
  get clipboard(): SurveyDefinition | undefined { return this.#clipboard.fragment; }

  get canPaste(): boolean { return this.#clipboard.fragment !== undefined && this.page !== undefined; }

  /** Pastes what was copied, after the selection — checklist K5. */
  paste(slot?: DropSlot): EditRefusal | undefined { return this.#clipboard.paste(this, slot); }

  /** Changes a question's type in place, keeping what the new type understands — K5. */
  convert(name: string, type: string): EditRefusal | undefined {
    return convertIn(this, name, type, this.#document.registry);
  }

  /** The types a question can be turned into. */
  get convertibleTypes(): readonly string[] { return convertibleTypes(this.#document.registry, this.#configuration); }

  /**
   * Swaps in a survey parsed from an edited definition.
   *
   * Nothing survives a re-parse by identity, so what is *about* the survey rather than
   * in it has to be carried across by name: the page being looked at, and what should
   * be selected once the dust settles. Losing either would mean a drop that scrolled
   * the designer back to page one with nothing selected — the edit landing correctly
   * and the canvas losing its place.
   */
  #reparse(definition: SurveyDefinition, name?: string, page?: string, isSurvey = false): void {
    this.#document.replace(definition, page);
    this.#placementRevision += 1;
    this.#selection.restore(name, this.pages, this.page, isSurvey);
    this.#announce();
  }

  get canUndo(): boolean { return this.#history.canUndo; }

  get canRedo(): boolean { return this.#history.canRedo; }

  /**
   * Takes back the last edit — checklist K6. Says whether there was one.
   *
   * A re-parse of a definition {@link DesignHistory} kept, which is the return on
   * [ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md) decision 3: no operation
   * has to know how to invert itself, so no future operation can forget to.
   */
  undo(): boolean { return this.#travel(this.#history.undo(this)); }

  /** Puts back what {@link undo} took — checklist K6. */
  redo(): boolean { return this.#travel(this.#history.redo(this)); }

  #travel(snapshot: HistorySnapshot | undefined): boolean {
    if (snapshot === undefined) {
      return false;
    }
    const invalidated = this.#placementSession.invalidate();
    this.#reparse(snapshot.definition, snapshot.selected, snapshot.page, snapshot.isSurveySelected);
    this.#publishPlacement(invalidated);
    return true;
  }

  /**
   * Runs an edit and tells everyone.
   *
   * Public because a host — and, in K5 and K6, the Creator itself — will have edits this
   * class does not name, and the alternative is either a method per operation or a
   * mutation nobody hears about. What matters is that *every* change comes through here.
   */
  change(edit: () => void, undoKey?: string): EditRefusal | undefined {
    // The two chokepoints K6 established are the two a restriction has to hold: between
    // them nothing reaches the survey, so read-only is enforced once rather than on every
    // button. A disabled button is a suggestion; this is the rule.
    if (this.isReadOnly) { return refuse('read-only'); }
    const invalidated = this.#placementSession.invalidate();
    this.#history.record(this, this.definition, undoKey);
    edit();
    this.#placementRevision += 1;
    this.#announce();
    this.#publishPlacement(invalidated);
    return undefined;
  }

  #publishPlacement(invalidated: boolean): void {
    if (invalidated) { this.#placementSession.publish(); }
  }

  #announce(): void {
    this.#version += 1;
    this.onChanged.emit(this.#version);
  }
}

