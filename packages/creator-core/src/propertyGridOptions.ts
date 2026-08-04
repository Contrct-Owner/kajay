import {
  GENERAL_CATEGORY,
  LOGIC_CATEGORY,
  orderPropertyCategories,
  PROPERTY_CATEGORIES,
} from './propertyCategories.js';

/**
 * What a host may change about the property grid — checklist L4.
 *
 * The grid is *generated*, which is what makes it complete and what makes it occasionally
 * wrong for one deployment: a survey tool for a school does not want `valueName` on screen,
 * and a host who registered `helpUrl` may want it beside the title rather than at the end
 * of General. This is the seam L1, L2 and L3 kept pointing at.
 *
 * **A plain value, not a class.** Nothing here is designer state — the search term in K1's
 * toolbox was, which is why *that* is stateful — so there is nothing to announce and
 * nothing to keep in step. It is also deliberately JSON-shaped, because §N2's "configure
 * the Creator" is the same decision arriving from a host's own configuration file.
 *
 * **Every field is a refinement of what the registry already said**, never a replacement
 * for it: a property this does not mention keeps its declared section, its derived label
 * and its place. A host who wants a different grid does not have to describe the whole one.
 */
export interface PropertyGridOptions {
  /**
   * Properties and collections the grid does not offer at all.
   *
   * By name, so `validators` hides the validators editor and `valueName` hides the field.
   * A section left with nothing in it is not drawn, so hiding every member of one removes
   * the heading too — there is no separate way to hide a section, and there does not need
   * to be.
   *
   * This is a *grid* decision and not a survey one: the value stays in the definition, and
   * a host who wants it gone edits the definition.
   */
  readonly hidden?: readonly string[];
  /** Sections by property name, winning over the built-in table. */
  readonly categories?: Readonly<Record<string, string>>;
  /**
   * Labels by property or collection name, winning over the derived one.
   *
   * L1 derives labels rather than tabling them, and said at the time that where the
   * derived one reads oddly this is where a host fixes it. "Col count" was the example.
   */
  readonly titles?: Readonly<Record<string, string>>;
  /** The order sections are drawn in. Replaces the built-in order outright. */
  readonly categoryOrder?: readonly string[];
  /**
   * Properties to draw first **within their own section**, in this order.
   *
   * One list rather than a list per section, because a host reordering a grid is thinking
   * "put `isRequired` near the top", not "position 3 of Validation". Anything not named
   * keeps the registry's order behind those that are — which is serialization order, and
   * the reason L1 did not curate one.
   */
  readonly order?: readonly string[];
}

/** Nothing customized. The value every caller falls back to. */
export const NO_GRID_OPTIONS: PropertyGridOptions = {};

/** Whether the grid offers this property or collection at all. */
export function isHidden(name: string, options: PropertyGridOptions): boolean {
  return options.hidden?.includes(name) ?? false;
}

/** The label to draw, when a host has replaced the derived one. */
export function titleOverride(name: string, options: PropertyGridOptions): string | undefined {
  return options.titles?.[name];
}

/**
 * Which section a property belongs to.
 *
 * The host's table, then the built-in one, then the registry's own `isExpression`, then
 * General — the L1 chain with one link added in front of it.
 */
export function categoryFor(
  name: string,
  isExpression: boolean,
  options: PropertyGridOptions,
): string {
  return (
    options.categories?.[name] ??
    PROPERTY_CATEGORIES.get(name) ??
    (isExpression ? LOGIC_CATEGORY : GENERAL_CATEGORY)
  );
}

/** The sections present, in the order to draw them. */
export function orderCategories(
  present: readonly string[],
  options: PropertyGridOptions,
): readonly string[] {
  const stated = options.categoryOrder;
  if (stated === undefined) {
    return orderPropertyCategories(present);
  }
  // A host's order replaces ours outright rather than merging, because a merge of two
  // orderings is a third one nobody wrote. Sections they did not name still follow, so
  // naming one section does not hide the rest.
  const known = stated.filter((name) => present.includes(name));
  return [...known, ...present.filter((name) => !stated.includes(name))];
}

/**
 * Rows in the order to draw them within one section.
 *
 * The named ones first in the order they were named, then everything else exactly as the
 * registry declared it. Sorting the remainder as well would replace serialization order —
 * the thing L1 chose on purpose — with an ordering a host had not asked for.
 */
export function orderRows<T extends { readonly name: string }>(
  rows: readonly T[],
  options: PropertyGridOptions,
): readonly T[] {
  const stated = options.order;
  if (stated === undefined) {
    return rows;
  }
  const named = stated
    .map((name) => rows.find((row) => row.name === name))
    .filter((row): row is T => row !== undefined);
  return [...named, ...rows.filter((row) => !named.includes(row))];
}
