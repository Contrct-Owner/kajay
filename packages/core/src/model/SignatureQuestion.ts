import { Question } from './Question.js';

/** What a signature is stored as. */
export type SignatureFormat = 'png' | 'jpeg' | 'svg';

const FORMATS: ReadonlySet<string> = new Set(['png', 'jpeg', 'svg']);

export function toSignatureFormat(value: string): SignatureFormat {
  return FORMATS.has(value) ? (value as SignatureFormat) : 'png';
}

/**
 * A signature drawn by hand — checklist H2.
 *
 * The answer is a data URL, so it travels with the response like any other string and
 * needs no upload seam of its own. Everything about *drawing* is the adapter's: core is
 * DOM-free, and a stroke is a sequence of pointer events on a canvas. What the model
 * owns is what the definition says — the ink, the paper, and what comes out.
 *
 * **Known gap, and it is a real one:** a canvas signature cannot be given by keyboard.
 * §J4 owns that, and the honest fix is an alternative rather than a better canvas — a
 * typed name that a host accepts as a signature. Recorded here so the row does not read
 * as though the question were finished.
 */
export class SignatureQuestion extends Question {
  override get type(): string {
    return 'signaturepad';
  }

  get penColor(): string {
    return this.getStringProperty('penColor');
  }

  /** Empty means transparent, which is what a signature on a form usually wants. */
  get backgroundColor(): string {
    return this.getStringProperty('backgroundColor');
  }

  get signatureFormat(): SignatureFormat {
    return toSignatureFormat(this.getStringProperty('signatureFormat'));
  }

  get signatureWidth(): number {
    return this.getNumberProperty('signatureWidth');
  }

  get signatureHeight(): number {
    return this.getNumberProperty('signatureHeight');
  }

  /** The signature as a data URL, or empty when nothing has been drawn. */
  get signature(): string {
    return typeof this.value === 'string' ? this.value : '';
  }

  /**
   * Records a drawn signature.
   *
   * An empty string clears the answer rather than storing one, so a respondent who
   * signs and then erases has not answered — the same rule every other question follows
   * about what an empty answer is.
   */
  setSignature(dataUrl: string): void {
    this.value = dataUrl.length > 0 ? dataUrl : undefined;
  }

  clear(): void {
    this.value = undefined;
  }
}
