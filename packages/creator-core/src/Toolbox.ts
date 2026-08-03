import { EventEmitter, globalRegistry } from '@kajay/core';
import type { MetadataRegistry } from '@kajay/core';
import { BUILT_IN_TOOLBOX, CATEGORY_ORDER } from './builtInToolbox.js';
import { fallbackTitle, OTHER_CATEGORY, toToolboxItem } from './ToolboxItem.js';
import type { ToolboxItem, ToolboxItemDefinition } from './ToolboxItem.js';

/** Items that belong together, in the order they are drawn. */
export interface ToolboxCategory {
  readonly name: string;
  readonly items: readonly ToolboxItem[];
}

export interface ToolboxOptions {
  /** Where the types come from. The global registry unless a host says otherwise. */
  readonly registry?: MetadataRegistry;
  /**
   * The base class whose concrete subclasses fill the toolbox.
   *
   * `pageelement` rather than `question`: a panel and an image are things a designer
   * drops on a page and are not questions, and a toolbox that only listed questions
   * would be missing the two most structural items in it.
   */
  readonly baseType?: string;
}

/**
 * What a designer can add, and how they find it — checklist K1.
 *
 * **Derived from the metadata registry**, so a custom question type appears here with
 * no further registration. That is the row's actual claim and it is worth being precise
 * about: nothing in this file lists the built-in types. `builtInToolbox.ts` says what
 * they are *called* and which drawer they are in, and a type missing from that table is
 * still in the toolbox — under a fallback title, in "Other". Auto-population is not a
 * courtesy extended to types somebody remembered to list.
 *
 * Stateful, because the search term is designer state and
 * [ADR-0021](../../../docs/adr/0021-creator-composition.md) puts all of it here: a panel
 * that held its own search box would be a second source of truth the moment a host
 * rendered two of them, or none.
 */
export class Toolbox {
  readonly #items: Map<string, ToolboxItem> = new Map();
  #search = '';

  /**
   * Advances on every change, so a view can snapshot it.
   *
   * A version rather than the items themselves, for the reason `logicVersion` is one:
   * `categories` builds a fresh array on every read, and a subscriber comparing
   * snapshots by identity would re-render forever.
   */
  #version = 0;

  readonly onChanged: EventEmitter<number> = new EventEmitter();

  constructor(options: ToolboxOptions = {}) {
    const registry = options.registry ?? globalRegistry;
    for (const type of registry.getConcreteSubclasses(options.baseType ?? 'pageelement')) {
      this.add({ type });
    }
  }

  get version(): number {
    return this.#version;
  }

  /** Every item, whatever the search says. */
  get items(): readonly ToolboxItem[] {
    return [...this.#items.values()];
  }

  /** What the designer has typed. */
  get search(): string {
    return this.#search;
  }

  setSearch(term: string): void {
    if (this.#search === term) {
      return;
    }
    this.#search = term;
    this.#announce();
  }

  /**
   * Adds an item, or replaces the one of that name.
   *
   * Replacing rather than refusing is what makes a host's curation possible: giving
   * `dropdown` a different title, or a different category, is the same act as adding an
   * item and should not need a removal first.
   */
  add(definition: ToolboxItemDefinition): void {
    const entry = BUILT_IN_TOOLBOX.get(definition.type);
    const item = toToolboxItem(
      definition,
      entry?.title ?? fallbackTitle(definition.type),
      entry?.category ?? OTHER_CATEGORY,
    );
    // Built-in keywords survive an override that does not mention them, so a host
    // retitling the dropdown does not silently make "select" stop finding it.
    const keywords = definition.keywords ?? entry?.keywords ?? [];
    this.#items.set(item.name, { ...item, keywords });
    this.#announce();
  }

  /** Removes an item by name. Removing one that is not there is not an error. */
  remove(name: string): void {
    if (this.#items.delete(name)) {
      this.#announce();
    }
  }

  /**
   * What to draw: the matching items, grouped, in category order.
   *
   * A category with nothing in it is not returned at all, so a search narrows the
   * toolbox rather than leaving a column of empty headings behind.
   */
  get categories(): readonly ToolboxCategory[] {
    const matched = this.items.filter((item) => matches(item, this.#search));
    const grouped = new Map<string, ToolboxItem[]>();
    for (const item of matched) {
      const bucket = grouped.get(item.category);
      if (bucket === undefined) {
        grouped.set(item.category, [item]);
      } else {
        bucket.push(item);
      }
    }
    return orderCategories([...grouped.keys()]).map((name) => ({
      name,
      items: grouped.get(name) ?? [],
    }));
  }

  /** Whether the current search found nothing. What a view says "no matches" for. */
  get isEmpty(): boolean {
    return this.categories.length === 0;
  }

  #announce(): void {
    this.#version += 1;
    this.onChanged.emit(this.#version);
  }
}

/**
 * Case-insensitive, and across the title, the type and the keywords.
 *
 * The type is searchable because a definition author knows it — somebody who has read
 * JSON is looking for `paneldynamic`, not "Repeating panel" — and the keywords because
 * somebody looking for a dropdown will type "select".
 */
function matches(item: ToolboxItem, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (term.length === 0) {
    return true;
  }
  return [item.title, item.type, ...item.keywords].some((candidate) =>
    candidate.toLowerCase().includes(term),
  );
}

/** Named categories first in their stated order, then anything else as it was met. */
function orderCategories(present: readonly string[]): readonly string[] {
  const known = CATEGORY_ORDER.filter((name) => present.includes(name));
  return [...known, ...present.filter((name) => !CATEGORY_ORDER.includes(name))];
}
