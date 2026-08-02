import type { MetadataRegistry } from '@kajay/core';
import { globalRegistry } from '@kajay/core';

export interface ToolboxItem {
  readonly type: string;
}

/**
 * Phase 3 scope. This package is a stub, but not an empty one: it holds the package
 * seam open and proves the `core ← creator-core` direction is real and enforced.
 *
 * The one function here is a preview of checklist K1 — the toolbox is *derived* from
 * the metadata registry, so a custom question type appears in the designer with no
 * additional registration.
 */
export function listToolboxItems(
  registry: MetadataRegistry = globalRegistry,
): readonly ToolboxItem[] {
  return registry.getConcreteSubclasses('question').map((type) => ({ type }));
}
