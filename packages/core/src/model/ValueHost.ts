/**
 * The seam a question reads and writes its answer through.
 *
 * It exists so `Question` never imports `Survey`: the model stays acyclic, and a
 * question can be unit-tested against a two-line stub host.
 */
export interface ValueHost {
  getValue(name: string): unknown;
  setValue(name: string, value: unknown): void;
}
