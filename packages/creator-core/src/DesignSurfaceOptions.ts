import type { MetadataRegistry, SurveyDefinition } from '@kajay/core';
import type { CreatorConfiguration } from './CreatorConfiguration.js';

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
  /**
   * `| undefined` explicitly, under `exactOptionalPropertyTypes`.
   *
   * So a caller building the options conditionally — which the default assembly does, from
   * its own optional prop — can pass `undefined` and mean "the global registry" rather than
   * being refused by the compiler. The same reason `CreatorComponents` spells it out.
   */
  readonly registry?: MetadataRegistry | undefined;
  /** What this deployment has turned off — checklist N2. Absent means nothing. */
  readonly configuration?: CreatorConfiguration | undefined;
  /**
   * The `{$name}` values this definition will be given at runtime — checklist B12.
   *
   * **Names, not values.** A designer has no host: there is no session, no CRM and no
   * entitlement service behind a canvas, so there is nothing true to show and a value here
   * would be a fiction the designer might come to rely on. What the Creator does need is
   * the *vocabulary*, so a definition that reads host context is not reported as broken
   * for depending on something no canvas can supply.
   *
   * Absent means none declared, and then a `{$name}` reference is diagnosed exactly as it
   * is anywhere else — which is right for a host that has not said otherwise.
   */
  readonly hostValueNames?: readonly string[] | undefined;
}
