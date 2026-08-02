/**
 * One reason an answer is not acceptable.
 *
 * Data rather than a class: an error has no behaviour, and a host that wants to supply
 * its own message should be able to produce one without reaching for a constructor.
 *
 * `kind` is the *rule* that objected, never the message — a renderer that wants to
 * style required-ness differently from a range failure needs something stable to match
 * on, and localized text is the one thing guaranteed not to be.
 */
export interface SurveyError {
  /** `required`, or the registered type of the validator that failed. */
  readonly kind: string;
  readonly text: string;
  /**
   * Which part of a composite answer the error is about.
   *
   * A multipletext holds several answers under one name, and so will a matrix cell.
   * Naming the part lets a renderer put the message beside the input that earned it,
   * rather than prefixing the text with a label the field is already showing — and the
   * prefix version cannot be undone by a host that wants to place them itself.
   */
  readonly path?: string;
}
