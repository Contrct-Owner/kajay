/**
 * The seam a question reads and writes its answer through.
 *
 * It exists so `Question` never imports `Survey`: the model stays acyclic, and a
 * question can be unit-tested against a two-line stub host.
 */
export interface ValueHost {
  getValue(name: string): unknown;
  setValue(name: string, value: unknown): void;
  /**
   * Whether the survey as a whole is for reading rather than answering.
   *
   * Here rather than passed down at construction because it changes at runtime — a host
   * flips it to show a submitted response — and a copy taken when the question was built
   * would be a second source of truth that never hears about it.
   */
  readonly isReadOnly: boolean;
}
