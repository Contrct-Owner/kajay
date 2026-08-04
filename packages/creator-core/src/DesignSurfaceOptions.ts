import type { MetadataRegistry, SurveyDefinition } from '@kajay/core';

/**
 * What a design surface is opened with, and what an edit carries.
 *
 * Beside the class rather than in it: both are read by the free functions that *make* the
 * edits — `designerEdits`, `elementEdits`, `collectionEdits` — and a type every edit module
 * imports from the class it edits is a cycle waiting to be drawn.
 */

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
