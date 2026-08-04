import { EventEmitter } from '@kajay/core';
import type { MetadataRegistry } from '@kajay/core';
import type { DesignSurface } from './DesignSurface.js';
import { localizedTextIn } from './propertyGrid.js';
import { collectTranslations, DEFAULT_LOCALE, localesUsed } from './translations.js';
import type { TranslationEntry } from './translations.js';
import { fromCsv, toCsv, translationCells, translationRows } from './translationSheet.js';

/** What a host's translation service is asked. One call per language, not one per string. */
export interface TranslationRequest {
  readonly from: string;
  readonly to: string;
  readonly texts: readonly string[];
}

/**
 * The machine-translation seam — checklist M4.
 *
 * A function, not an interface, and asynchronous because every translation service is. It
 * is asked for a **batch**: one call carrying every untranslated string, because a service
 * charged per request would otherwise be billed once per title, and because a translator
 * given the whole page has the context to do better than one given a word.
 *
 * Nothing ships. Which service, which key, which terms of use and whose data leaves the
 * building are the host's decisions, exactly as the file-upload seam (H1) and the
 * server-side validator (D4) are.
 */
export type MachineTranslator = (request: TranslationRequest) => Promise<readonly string[]>;

export interface TranslationSessionOptions {
  readonly registry?: MetadataRegistry | undefined;
  readonly translate?: MachineTranslator | undefined;
}

/** What a machine translation did. `undefined` for the language means it was refused. */
export interface TranslationRunResult {
  readonly filled: number;
  readonly error: string | undefined;
}

/**
 * Every translatable string in the survey, in every language — checklist M4.
 *
 * **The table is derived, never stored.** `entries` walks the survey on every read, so a
 * question added on the canvas has a row here without anything being told, and a question
 * deleted takes its row with it. There is no second list of strings to fall out of step
 * with the survey, which is the failure mode every translation tool has.
 *
 * Editing goes through `DesignSurface.setLocalized`, so it is L2's rule — a language is
 * written into the property in place, never over the top of the others — and it is
 * undoable like everything else.
 */
export class TranslationSession {
  readonly #surface: DesignSurface;
  readonly #options: TranslationSessionOptions;
  readonly #unsubscribe: () => void;
  /** Languages a designer has opened a column for but not yet written in. */
  #added: readonly string[] = [];
  #isTranslating = false;
  #version = 0;

  readonly onChanged: EventEmitter<number> = new EventEmitter();

  constructor(surface: DesignSurface, options: TranslationSessionOptions = {}) {
    this.#surface = surface;
    this.#options = options;
    // Redrawn whenever the design changes, because the table *is* the design: no snapshot
    // to go stale, and so nothing to ask the designer about.
    this.#unsubscribe = surface.onChanged.add(() => {
      this.#announce();
    });
  }

  get version(): number {
    return this.#version;
  }

  get entries(): readonly TranslationEntry[] {
    return collectTranslations(this.#surface.survey, this.#registry);
  }

  /**
   * The columns: every language written somewhere, plus any a designer has opened.
   *
   * `default` is always first, because it is what everything else is translated *from* and
   * a table whose source column moved around would be unreadable.
   */
  get locales(): readonly string[] {
    const used = localesUsed(this.entries);
    return [...used, ...this.#added.filter((locale) => !used.includes(locale))];
  }

  /**
   * Opens a column for a language nobody has written in yet.
   *
   * A **column**, not a translation: writing `{ fr: "" }` into every string would put a
   * hundred empty translations in the definition that nobody authored — L2's decision
   * about a single property, applied to the table.
   */
  addLocale(locale: string): boolean {
    const trimmed = locale.trim();
    if (trimmed.length === 0 || this.locales.includes(trimmed)) {
      return false;
    }
    this.#added = [...this.#added, trimmed];
    this.#announce();
    return true;
  }

  /**
   * Closes a column nobody has written in. Says whether it went.
   *
   * **Refused once the language has any translation in it**, because there is no such
   * thing as hiding one: the column is derived from what is written, so "remove" would
   * have to mean "delete every German string in the survey". That is a real operation and
   * a designer may well want it, but it is not what closing a column looks like, and
   * making one button mean both is how somebody loses a week's work.
   */
  removeLocale(locale: string): boolean {
    if (!this.#added.includes(locale) || localesUsed(this.entries).includes(locale)) {
      return false;
    }
    this.#added = this.#added.filter((added) => added !== locale);
    this.#announce();
    return true;
  }

  /** What one string says in one language. Empty when it has not been translated. */
  textIn(entry: TranslationEntry, locale: string): string {
    return localizedTextIn(entry.value, locale);
  }

  /** Writes one string in one language — L2's `setLocalized`, and undoable like it. */
  setText(entry: TranslationEntry, locale: string, text: string): boolean {
    return this.#surface.setLocalized(entry.element, entry.property, locale, text);
  }

  /** How many strings have nothing in this language yet. What a progress readout shows. */
  missingIn(locale: string): number {
    return this.#untranslated(locale).length;
  }

  get isTranslating(): boolean {
    return this.#isTranslating;
  }

  /**
   * Fills in a language from a host's translation service — checklist M4.
   *
   * **Only the empty cells.** A machine never overwrites a translation a person wrote,
   * because the whole reason a person wrote it is that the machine got it wrong; running
   * this twice must be safe, and it is only safe if it is additive.
   *
   * A service that hands back the wrong number of strings is **refused entirely** rather
   * than applied as far as it goes. The alignment between requests and answers is
   * positional — that is what a batch is — so a short answer does not mean "some of them
   * failed", it means every string after the gap is now labelled with somebody else's
   * translation. That is the failure this row must not have.
   */
  async translateInto(locale: string, from: string = DEFAULT_LOCALE): Promise<TranslationRunResult> {
    const translate = this.#options.translate;
    if (translate === undefined) {
      return { filled: 0, error: 'No translation service is configured.' };
    }
    const pending = this.#untranslated(locale, from);
    if (pending.length === 0) {
      return { filled: 0, error: undefined };
    }
    this.#isTranslating = true;
    this.#announce();
    try {
      const texts = pending.map((entry) => this.textIn(entry, from));
      const answers = await translate({ from, to: locale, texts });
      if (answers.length !== texts.length) {
        return {
          filled: 0,
          error: `Expected ${String(texts.length)} translations and received ${String(answers.length)}.`,
        };
      }
      return { filled: this.#write(pending, locale, answers), error: undefined };
    } catch (error) {
      return { filled: 0, error: error instanceof Error ? error.message : String(error) };
    } finally {
      this.#isTranslating = false;
      this.#announce();
    }
  }

  #write(
    pending: readonly TranslationEntry[],
    locale: string,
    answers: readonly string[],
  ): number {
    let filled = 0;
    for (const [index, entry] of pending.entries()) {
      const text = answers[index] ?? '';
      if (text.length > 0 && this.setText(entry, locale, text)) {
        filled += 1;
      }
    }
    return filled;
  }

  /** Strings with something to translate *from* and nothing in the target language yet. */
  #untranslated(locale: string, from: string = DEFAULT_LOCALE): readonly TranslationEntry[] {
    return this.entries.filter(
      (entry) => this.textIn(entry, from).length > 0 && this.textIn(entry, locale).length === 0,
    );
  }

  /** The table as a rectangle of strings — hand this to any spreadsheet library. */
  toRows(): readonly (readonly string[])[] {
    return translationRows(this.entries, this.locales);
  }

  /** The table as CSV. */
  toCsv(): string {
    return toCsv(this.toRows());
  }

  /**
   * Reads a sheet back in. Says what landed and what did not.
   *
   * **Unmatched keys are reported, not dropped in silence.** A translator sends a file back
   * a week after a question was renamed, and the honest answer is "these forty landed and
   * these three no longer exist" — a count of forty with no mention of the three is how a
   * survey ships with a language nobody notices is missing three strings.
   */
  applyRows(rows: readonly (readonly string[])[]): { applied: number; unmatched: readonly string[] } {
    const byKey = new Map(this.entries.map((entry) => [entry.key, entry]));
    const unmatched = new Set<string>();
    let applied = 0;
    for (const cell of translationCells(rows)) {
      const entry = byKey.get(cell.key);
      if (entry === undefined) {
        unmatched.add(cell.key);
        continue;
      }
      // An unchanged cell is not an edit. Without this, importing a file nobody touched
      // would be a hundred undo entries and a survey that reports itself modified.
      if (this.textIn(entry, cell.locale) !== cell.text && this.setText(entry, cell.locale, cell.text)) {
        applied += 1;
      }
    }
    return { applied, unmatched: [...unmatched] };
  }

  /** Reads a CSV file back in. */
  applyCsv(text: string): { applied: number; unmatched: readonly string[] } {
    return this.applyRows(fromCsv(text));
  }

  /** Stops following the designer. A host that discards a session should call this. */
  dispose(): void {
    this.#unsubscribe();
  }

  get #registry(): MetadataRegistry {
    return this.#options.registry ?? this.#surface.registry;
  }

  #announce(): void {
    this.#version += 1;
    this.onChanged.emit(this.#version);
  }
}
