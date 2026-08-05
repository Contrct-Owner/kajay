/**
 * Which piece of authored text is being drawn — checklist P10.
 *
 * **The text seam used to say only what kind of text it was.** `(text, where)` let a host
 * allow markup in a description and refuse it in a label, which is what I6 needed and all
 * it needed. It cannot answer the question the Creator has to ask: *which* question's title
 * is this, so that typing on it writes back to the right element.
 *
 * Identity rather than a model reference, deliberately. Every Creator edit re-parses the
 * definition and nothing survives by name except the name
 * ([ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md) decision 3), so a subject
 * holding a `Question` would be stale the moment it was used. A name and a property are
 * still true after the re-parse.
 */
export interface TextSubject {
  /**
   * What sort of text this is — `title`, `description`, `choice`.
   *
   * I6's original `where`, kept under a clearer name. A host deciding whether markup is
   * allowed cares about the kind and not about the storage.
   */
  readonly kind: string;
  /** The element it belongs to, by name. */
  readonly owner: string;
  /** The property it is stored under: `title`, or `choices` for an item's label. */
  readonly property: string;
  /** Which item, when the text lives in a child collection. Absent for a plain property. */
  readonly index?: number | undefined;
}
