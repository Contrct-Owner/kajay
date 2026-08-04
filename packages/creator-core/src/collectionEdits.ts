import { moveWithin } from '@kajay/core';
import type {
  ChildCollectionDescriptor,
  MetadataRegistry,
  SurveyDefinition,
  SurveyElement,
} from '@kajay/core';
import type { DesignSurface } from './DesignSurface.js';
import { uniqueName } from './definitionTree.js';
import { fastEntryItems } from './fastEntry.js';
import { takenNames } from './fragments.js';
import { refuse } from './EditRefusal.js';
import type { EditRefusal } from './EditRefusal.js';

/**
 * Adding, removing, reordering and bulk-editing a child collection — checklist L2.
 *
 * **Structural edits, so they go through `applyEdit`** and are undoable without a line
 * about undo — [ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md) decision 3
 * paying out for the fourth time. It matters more here than it looked: a validator is not
 * a bag of properties, it is a rule the parser registers with the logic engine, and a
 * version of this that pushed one into the model's array would produce a validator that
 * serialized correctly and never ran.
 *
 * The owner is the **element**, and that is a guard as much as a convenience: only the
 * element says which registered class declares the collection, and without asking, adding
 * `choices` to a text question would write a key the type does not have — an unknown
 * property that round-trips forever and edits nothing. What is passed *down* from here is
 * the name, because nothing survives the re-parse by identity and names are unique across
 * a survey, which is what makes one deep walk enough to find a choice list on a matrix
 * column three levels down.
 */

/** The collection an element declares under this property, if it declares one. */
function declared(
  owner: SurveyElement,
  property: string,
  registry: MetadataRegistry,
): ChildCollectionDescriptor | undefined {
  return registry.getChildCollection(owner.type, property);
}

function nameOf(owner: SurveyElement): string {
  const name = owner.getPropertyValue('name');
  return typeof name === 'string' ? name : '';
}

/**
 * Adds a child of `type` at the end. Says why it did not, or `undefined` when it did.
 *
 * Two different refusals that used to be one `false`: a collection this type does not
 * declare, and an owner the definition no longer holds. A designer meets the second by
 * editing a question that has since been deleted in another view, and "this type has no
 * choices to set" would be a confusing thing to read about a radiogroup.
 */
export function addChildTo(
  surface: DesignSurface,
  owner: SurveyElement,
  property: string,
  type: string,
  registry: MetadataRegistry,
): EditRefusal | undefined {
  const collection = declared(owner, property, registry);
  const before = surface.definition;
  const children = childrenIn(before, nameOf(owner), property);
  if (collection === undefined) {
    return refuse('unknown-property', property);
  }
  if (children === undefined) {
    return refuse('not-found', nameOf(owner));
  }
  const child = freshChild(
    type,
    collection.shorthandProperty,
    children,
    registry,
    takenNames(before),
  );
  return apply(surface, before, nameOf(owner), property, [...children, child]);
}

export function removeChildFrom(
  surface: DesignSurface,
  owner: SurveyElement,
  property: string,
  index: number,
  registry: MetadataRegistry,
): EditRefusal | undefined {
  const before = surface.definition;
  const children = childrenIn(before, nameOf(owner), property);
  if (declared(owner, property, registry) === undefined) {
    return refuse('unknown-property', property);
  }
  // An index outside the collection is the same fact as an owner that is not there: the
  // thing this call names does not exist. Both are `not-found`, because a designer cannot
  // act on the difference and a second message would only ask them to.
  if (children === undefined || index < 0 || index >= children.length) {
    return refuse('not-found', nameOf(owner));
  }
  return apply(
    surface,
    before,
    nameOf(owner),
    property,
    children.filter((_unused, at) => at !== index),
  );
}

/**
 * Moves a child within its collection.
 *
 * `moveWithin` is C9's own list arithmetic, reused rather than rewritten — the third place
 * in this codebase that needs "take that one out and put it here", and the first two
 * already proved how easy the off-by-one is to get wrong.
 */
export function moveChildIn(
  surface: DesignSurface,
  owner: SurveyElement,
  property: string,
  from: number,
  to: number,
  registry: MetadataRegistry,
): EditRefusal | undefined {
  const before = surface.definition;
  const children = childrenIn(before, nameOf(owner), property);
  if (declared(owner, property, registry) === undefined) {
    return refuse('unknown-property', property);
  }
  if (children === undefined) {
    return refuse('not-found', nameOf(owner));
  }
  const moved = moveWithin(children, from, to);
  // A drag that lands where it started is **not a refusal**: nothing went wrong and there
  // is nothing to tell anybody. It reports success and records no undo entry, which is the
  // distinction a boolean could not draw — `false` meant both "refused" and "no-op".
  return moved === children
    ? undefined
    : apply(surface, before, nameOf(owner), property, moved);
}

/**
 * Replaces a whole collection from fast-entry text — checklist L2.
 *
 * One edit rather than one per line, so a rewritten choice list is one press of undo.
 */
export function setFastEntryIn(
  surface: DesignSurface,
  owner: SurveyElement,
  property: string,
  text: string,
  registry: MetadataRegistry,
): EditRefusal | undefined {
  // No shorthand, nothing a line of text can be: a validator has no scalar form.
  const shorthand = declared(owner, property, registry)?.shorthandProperty;
  const before = surface.definition;
  const children = childrenIn(before, nameOf(owner), property);
  if (shorthand === undefined) {
    return refuse('unknown-property', property);
  }
  if (children === undefined) {
    return refuse('not-found', nameOf(owner));
  }
  const items = fastEntryItems(text, shorthand, children, surface.survey.locale);
  const name = nameOf(owner);
  return apply(surface, before, name, property, items, `collection:${name}:${property}`);
}

function apply(
  surface: DesignSurface,
  before: SurveyDefinition,
  owner: string,
  property: string,
  items: readonly SurveyDefinition[],
  undoKey?: string,
): EditRefusal | undefined {
  const after = withChildren(before, owner, property, items);
  // The selection is left where it was on purpose: editing a question's choices is
  // working on that question, and moving the grid off it under the designer would take
  // away the panel they are typing in.
  // Returned rather than discarded, so N2's read-only refusal reaches the collection
  // editor without this function knowing the restriction exists.
  return surface.applyEdit(after, {
    select: surface.selection.name,
    from: before,
    ...(undoKey === undefined ? {} : { undoKey }),
  });
}

/**
 * A child nothing has seen before.
 *
 * Two things may need filling in, and which they are is asked of the registry rather than
 * of the collection's name. A type that **requires a name** gets one from the survey-wide
 * pool, stemmed on the type — `text1`, exactly what the toolbox produces, because a matrix
 * column that is a text question is the same kind of thing arriving by a different door. A
 * collection with a **shorthand** gets that property filled from a pool of its own, stemmed
 * on the property, because a choice's value is unique within its list and means nothing
 * outside it.
 *
 * Everything else is left absent, so the parser supplies the registered defaults — the
 * same path a question dropped from the toolbox takes.
 */
function freshChild(
  type: string,
  shorthand: string | undefined,
  children: readonly SurveyDefinition[],
  registry: MetadataRegistry,
  taken: ReadonlySet<string>,
): SurveyDefinition {
  const child: SurveyDefinition = { type };
  for (const descriptor of registry.getProperties(type)) {
    if (!descriptor.isRequired) {
      continue;
    }
    if (descriptor.name === 'name') {
      child['name'] = uniqueName(type, taken);
    } else if (descriptor.name === shorthand) {
      child[descriptor.name] = uniqueName(descriptor.name, valuesIn(children, descriptor.name));
    }
  }
  return child;
}

function valuesIn(children: readonly SurveyDefinition[], property: string): ReadonlySet<string> {
  const used = new Set<string>();
  for (const child of children) {
    const value = child[property];
    if (typeof value === 'string' || typeof value === 'number') {
      used.add(String(value));
    }
  }
  return used;
}

/** The definitions in one element's collection, or `undefined` if there is no such list. */
export function childrenIn(
  definition: SurveyDefinition,
  owner: string,
  property: string,
): readonly SurveyDefinition[] | undefined {
  const found = ownerIn(definition, owner);
  if (found === undefined) {
    return undefined;
  }
  const value = found[property];
  // `[]` for a collection with nothing in it and `undefined` for no such collection are
  // different answers, and canonical form elides the first — so an absent key on an
  // element that exists means an empty list, not a missing one.
  return Array.isArray(value) ? value.filter((entry) => isDefinition(entry)) : [];
}

/** The same definition with one element's collection replaced. */
export function withChildren(
  definition: SurveyDefinition,
  owner: string,
  property: string,
  items: readonly SurveyDefinition[],
): SurveyDefinition {
  if (isRoot(owner)) {
    return { ...definition, [property]: items };
  }
  return rewriteNamed(definition, owner, (found) => ({ ...found, [property]: items }));
}

/**
 * The object a collection hangs off, given the name of its owner.
 *
 * **An empty name is the survey** — checklist L5. It is the root, and it has no name
 * because it is the thing names are unique within (see `DesignSelection`), so there is
 * nothing to walk the tree looking for. Written as one function rather than a branch in
 * each caller, because "the survey has no name" is a fact that must be said once.
 */
function ownerIn(definition: SurveyDefinition, owner: string): SurveyDefinition | undefined {
  return isRoot(owner) ? definition : findNamed(definition, owner);
}

function isRoot(owner: string): boolean {
  return owner.length === 0;
}

/**
 * The first object in the tree answering to a name.
 *
 * A deep walk rather than pages-then-elements, because the thing being edited may be a
 * matrix column, a multiple-text item, or a question inside a detail panel. Names are
 * unique across a survey — `collectNames` and `uniqueName` are what make that true — so
 * "the first" is "the only".
 */
function findNamed(value: unknown, owner: string): SurveyDefinition | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNamed(item, owner);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }
  if (!isDefinition(value)) {
    return undefined;
  }
  if (value['name'] === owner) {
    return value;
  }
  for (const child of Object.values(value)) {
    const found = findNamed(child, owner);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

/**
 * The same tree with one named object replaced.
 *
 * Returns the **same reference** wherever nothing underneath changed, so editing a choice
 * list does not rebuild the questions around it — the sharing `withList` established for
 * the canvas, generalized to any element with a name.
 */
function rewriteNamed(
  value: unknown,
  owner: string,
  change: (found: SurveyDefinition) => SurveyDefinition,
): SurveyDefinition {
  return rewrite(value, owner, change) as SurveyDefinition;
}

function rewrite(
  value: unknown,
  owner: string,
  change: (found: SurveyDefinition) => SurveyDefinition,
): unknown {
  if (Array.isArray(value)) {
    let touched = false;
    const items = value.map((item) => {
      const next = rewrite(item, owner, change);
      touched ||= next !== item;
      return next;
    });
    return touched ? items : value;
  }
  if (!isDefinition(value)) {
    return value;
  }
  if (value['name'] === owner) {
    return change(value);
  }
  let output: SurveyDefinition | undefined;
  for (const [key, child] of Object.entries(value)) {
    const next = rewrite(child, owner, change);
    if (next !== child) {
      output ??= { ...value };
      output[key] = next;
    }
  }
  return output ?? value;
}

function isDefinition(value: unknown): value is SurveyDefinition {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
