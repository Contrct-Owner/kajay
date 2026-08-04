import { EventEmitter } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';

/**
 * The host's save seam — checklist N1.
 *
 * A function, and asynchronous because saving is. It says whether the save *worked*, which
 * is the whole of what the Creator needs to know: everything else — where it went, what the
 * request looked like, whether to retry — is the host's, exactly as the file-upload seam
 * (H1) and the machine-translation seam (M4) are.
 */
export type SurveySaver = (definition: SurveyDefinition) => boolean | Promise<boolean>;

/** What the Creator can say about the last save. */
export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

/**
 * Saving, and auto-saving, without a clock — checklist N1.
 *
 * **No timer, and that is deliberate.** A debounce would put a clock inside the Creator,
 * which makes "did it save" depend on how fast somebody types and makes every test about it
 * a race. Instead a save in flight *absorbs* the requests that arrive during it: the latest
 * definition is remembered, and exactly one more save runs when the current one finishes.
 * A host who wants a delay wraps their own saver in one, which is the only place that
 * decision can be made well — they know what their backend costs.
 *
 * The coalescing is the same shape B2's async function cache uses, and for the same reason:
 * the work is keyed on what it is *for* rather than on when it was asked for.
 */
export class SaveController {
  readonly #save: SurveySaver;
  #state: SaveState = 'idle';
  #isSaving = false;
  /** The definition a save should run for once the current one is done. */
  #pending: SurveyDefinition | undefined;
  #version = 0;

  readonly onChanged: EventEmitter<number> = new EventEmitter();

  constructor(save: SurveySaver) {
    this.#save = save;
  }

  get state(): SaveState {
    return this.#state;
  }

  get version(): number {
    return this.#version;
  }

  /** Whether a save is running now. What a "Saving…" label is drawn from. */
  get isSaving(): boolean {
    return this.#isSaving;
  }

  /**
   * Asks for this definition to be saved.
   *
   * Returns immediately: a save is something a designer is told about, not something they
   * wait for. What happened arrives through {@link state}.
   */
  request(definition: SurveyDefinition): void {
    if (this.#isSaving) {
      // Only the latest survives. Saving every intermediate definition would send a
      // request per keystroke to a backend that only ever wanted the last one.
      this.#pending = definition;
      return;
    }
    void this.#run(definition);
  }

  async #run(definition: SurveyDefinition): Promise<void> {
    this.#isSaving = true;
    this.#setState('saving');
    let ok = false;
    try {
      ok = await this.#save(definition);
    } catch {
      // A saver that throws has failed, which is the same answer as returning false. The
      // Creator has nothing useful to add to the host's own error, and swallowing it here
      // is what stops one failed save taking the designer's work down with it.
      ok = false;
    }
    this.#isSaving = false;
    const next = this.#pending;
    this.#pending = undefined;
    if (next === undefined) {
      this.#setState(ok ? 'saved' : 'failed');
      return;
    }
    // Something changed while that was in flight, so the answer is already out of date.
    // Reporting `saved` here and then saving again would flicker through a state that was
    // never true of what is on screen.
    await this.#run(next);
  }

  #setState(state: SaveState): void {
    this.#state = state;
    this.#version += 1;
    this.onChanged.emit(this.#version);
  }
}

/**
 * Whether two definitions say the same thing — checklist N1's controlled value.
 *
 * Compared as canonical JSON rather than by identity, because every read of
 * `DesignSurface.definition` builds a fresh object: a controlled component that compared by
 * identity would call `onChange` forever, and one that compared by identity the other way
 * would re-open the document on every render.
 */
export function sameDefinition(
  left: SurveyDefinition | undefined,
  right: SurveyDefinition | undefined,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
