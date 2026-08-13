import type { ChildCollectionDescriptor, MetadataRegistry, SurveyElement } from '@kajay/core';
import { humanizePropertyName } from './propertyGrid.js';
import { isHidden, NO_GRID_OPTIONS, titleOverride } from './propertyGridOptions.js';
import type { PropertyGridOptions } from './propertyGridOptions.js';

/**
 * The child collections of an element, ready to edit — checklist L2.
 *
 * **Choices and validators are the row's words; neither is named here.** They are child
 * collections, the registry declares them, and so are matrix columns, matrix rows,
 * multiple-text items and a rating's own labels. One editor covers all of them for the
 * same reason L1's grid covers every property: the thing that differs between them is
 * metadata, and metadata is what the registry holds.
 *
 * What makes the two named editors *feel* specialized is not special code. A choices
 * editor is a collection whose registry entry declares a **shorthand** — `choices: ["a"]`
 * means `[{ value: "a" }]` — and that is exactly the condition under which bulk text entry
 * can round-trip, so fast entry is offered where the shorthand is and nowhere else. A
 * validators editor is a collection whose base type has several concrete subclasses, so it
 * needs a type picker where a choice list does not.
 */

/** One child collection an element holds. */
export interface CollectionRow {
  /** The JSON property the children live under: `choices`, `validators`, `columns`. */
  readonly property: string;
  readonly title: string;
  /**
   * The concrete types a new child may be.
   *
   * One entry for `choices` — every choice is an `itemvalue`, which is itself concrete —
   * and seven for `validators`. A view showing a picker for the second and a plain "add"
   * for the first is reading this, not asking which collection it is looking at.
   *
   * **Empty is a real answer**, and the reason there is no fallback to the base type: a
   * collection whose base is abstract with nothing under it has nothing that can be
   * constructed, and offering the abstract name would produce a child the registry
   * refuses to create. A view with no types to offer draws no Add control.
   */
  readonly types: readonly string[];
  /**
   * The children as the model holds them.
   *
   * Real elements rather than a parallel description, so each one is edited by exactly
   * the grid L1 already built — a validator's `minValue` is a registered number property
   * and needs nothing new to be editable.
   */
  readonly children: readonly SurveyElement[];
  /**
   * The property a bare scalar is read into, when the registry declares one.
   *
   * `undefined` for a collection that has no shorthand, which is how a view knows fast
   * entry cannot express it.
   */
  readonly shorthand: string | undefined;
}

/**
 * The collections a designer may edit, grouped by nothing — the grid groups them.
 *
 * **`elements` and `pages` are deliberately absent.** What is on a page is the canvas's
 * and what pages there are is the navigator's: K2, K3 and K4 built dragging, dropping,
 * selecting, adorning and reordering for exactly those two collections, and a second way
 * to reorder either here would be a second place for the two to disagree.
 *
 * The rule is the *base type*, not the property name, so a host's own container is excluded
 * for the same reason — and everything else the survey holds falls in without being asked
 * for: selecting the survey (§L5) makes its calculated values, its triggers and its
 * conditional endings editable with no code about any of them.
 */
export function collectionRowsFor(
  element: SurveyElement,
  registry: MetadataRegistry,
  options: PropertyGridOptions = NO_GRID_OPTIONS,
): readonly CollectionRow[] {
  const rows: CollectionRow[] = [];
  for (const collection of registry.getChildCollections(element.type)) {
    // Hidden by the same list that hides a property (§L4): to a host, "do not show the
    // validators editor" and "do not show `valueName`" are one kind of decision.
    if (SURFACE_OWNED.has(collection.elementBaseType) || isHidden(collection.property, options)) {
      continue;
    }
    rows.push({
      property: collection.property,
      title:
        titleOverride(collection.property, options) ?? humanizePropertyName(collection.property),
      types: offerable(collection, registry),
      children: element.getChildren(collection.property),
      shorthand: collection.shorthandProperty,
    });
  }
  return rows;
}

/**
 * The types a designer may actually add here.
 *
 * The concrete subclasses of the base, less the ones the collection's own placement rules
 * out: children positioned by a marker sit *in a line of prose*, so only a type that says
 * it can be drawn there may be offered. The picker used to offer all nineteen question
 * types for a sentence's blanks — a matrix, a file upload, another sentence — each of
 * which the parser rejects with `non-inline-blank` the moment it is added.
 *
 * Read from the registry rather than a list here, so a host's own inline type is offered
 * the day it registers and nothing has to remember it exists.
 */
function offerable(
  collection: ChildCollectionDescriptor,
  registry: MetadataRegistry,
): readonly string[] {
  const types = registry.getConcreteSubclasses(collection.elementBaseType);
  return collection.markerProperty === undefined
    ? types
    : types.filter((type) => registry.getClass(type)?.allowsInline === true);
}

/** The bases whose collections the canvas and the page navigator own rather than the grid. */
const SURFACE_OWNED: ReadonlySet<string> = new Set(['pageelement', 'page']);

/**
 * What to call a child in the list — checklist L2.
 *
 * Derived, in the order a reader would guess: what it is called, else what it stands for,
 * else what it is. A matrix column has a `name`, a choice has a `value`, and a validator
 * has neither — so a validator is listed by its type, which is the only thing that
 * distinguishes two of them anyway.
 *
 * A table of labels would have the problem L1's would have had, one level down: it would
 * be missing an entry the day a collection arrived, and a host's own child type would be
 * the one row with nothing to read.
 *
 * The *order* of the first two is unobservable today and is left alone deliberately: no
 * registered child type declares both a `name` and a `value`, so a mutation that swaps
 * them survives, correctly. Each branch is reached; only the precedence between them is
 * not, and inventing a type to pin it would be pinning a decision nothing depends on.
 */
export function childLabel(child: SurveyElement): string {
  const named = asText(child.getResolvedProperty('name'));
  const valued = asText(child.getResolvedProperty('value'));
  return named ?? valued ?? child.type;
}

function asText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value.length > 0 ? value : undefined;
  }
  return typeof value === 'number' || typeof value === 'boolean' ? String(value) : undefined;
}
