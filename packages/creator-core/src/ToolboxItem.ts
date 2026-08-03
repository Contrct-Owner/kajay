import type { PropertyValue } from '@kajay/core';

/**
 * One thing a designer can put on a page — checklist K1.
 *
 * **`name` rather than `type` is the identity**, because one type can legitimately
 * appear more than once: "Rating (stars)" and "Rating (smileys)" both create a `rating`
 * and differ only in what it starts as. A toolbox keyed by type could not hold both,
 * and that shape is exactly what a host adding a custom item reaches for.
 */
export interface ToolboxItem {
  /** Unique within a toolbox. Defaults to `type` for the one-item-per-type case. */
  readonly name: string;
  /** The registered class a drop creates. */
  readonly type: string;
  /** What a designer reads. */
  readonly title: string;
  readonly category: string;
  /**
   * Search terms beyond the title and the type.
   *
   * Somebody looking for a dropdown may well type "select", and a toolbox that only
   * matched our vocabulary would send them scrolling.
   */
  readonly keywords: readonly string[];
  /** Properties the created element starts with. */
  readonly defaults: Readonly<Record<string, PropertyValue>>;
}

/** What a caller supplies. Everything but `type` has a sensible answer. */
export interface ToolboxItemDefinition {
  readonly type: string;
  readonly name?: string;
  readonly title?: string;
  readonly category?: string;
  readonly keywords?: readonly string[];
  readonly defaults?: Readonly<Record<string, PropertyValue>>;
}

/** Where a type goes when nothing has an opinion about it. */
export const OTHER_CATEGORY = 'Other';

/**
 * A title for a type nobody named.
 *
 * Deliberately not clever. `starrating` becomes "Starrating", which is plainly a
 * fallback rather than a guess dressed up as a name — a host registering a custom type
 * supplies a title, and a mangled one that looked deliberate would stop them noticing
 * they had not.
 */
export function fallbackTitle(type: string): string {
  return type.length === 0 ? type : type[0]!.toUpperCase() + type.slice(1);
}

export function toToolboxItem(
  definition: ToolboxItemDefinition,
  title: string,
  category: string,
): ToolboxItem {
  return {
    name: definition.name ?? definition.type,
    type: definition.type,
    title: definition.title ?? title,
    category: definition.category ?? category,
    keywords: definition.keywords ?? [],
    defaults: definition.defaults ?? {},
  };
}
