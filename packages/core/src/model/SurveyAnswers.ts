import type { CalculatedValue } from './CalculatedValue.js';
import { CalculatedValueStore } from './CalculatedValueStore.js';

/** What a write did, so the caller can decide whether anything is worth announcing. */
export interface WriteResult {
  readonly changed: boolean;
  readonly previousValue: unknown;
}

/**
 * The two things a survey knows the value of: answers, and computed values.
 *
 * Held together because every reader wants both — an expression referencing `{total}`
 * neither knows nor cares which side it came from — while writers must keep them
 * apart, since only one of the two is something a respondent typed.
 */
export class SurveyAnswers {
  readonly #data: Map<string, unknown> = new Map();
  readonly #calculated: CalculatedValueStore = new CalculatedValueStore();

  /** An answer only. Calculated values are deliberately not visible here. */
  get(name: string): unknown {
    return this.#data.get(name);
  }

  /** What an expression sees: an answer if there is one, otherwise a computed value. */
  resolve(name: string): unknown {
    return this.#data.has(name) ? this.#data.get(name) : this.#calculated.get(name);
  }

  getCalculated(name: string): unknown {
    return this.#calculated.get(name);
  }

  /** Records an answer. `undefined` removes it rather than storing a hole. */
  write(name: string, value: unknown): WriteResult {
    const previousValue = this.#data.get(name);
    if (Object.is(previousValue, value)) {
      return { changed: false, previousValue };
    }
    if (value === undefined) {
      this.#data.delete(name);
    } else {
      this.#data.set(name, value);
    }
    return { changed: true, previousValue };
  }

  writeCalculated(name: string, value: unknown): WriteResult {
    return this.#calculated.set(name, value);
  }

  /** Answers plus any calculated value marked `includeIntoResult`. */
  toResult(
    calculatedValues: readonly CalculatedValue[],
  ): Readonly<Record<string, unknown>> {
    return {
      ...Object.fromEntries(this.#data),
      ...this.#calculated.toResult(calculatedValues),
    };
  }
}
