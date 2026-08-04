import { EventEmitter } from '@kajay/core';
import { locationOf, syntaxErrorOffset } from './jsonLocation.js';
import type { JsonLocation } from './jsonLocation.js';
import { BUILT_IN_THEME_FIELDS, themeRowsFor, withValueAt } from './themeFields.js';
import type { ThemeDocument, ThemeField, ThemeRow } from './themeFields.js';

/** Why an imported theme cannot be read. The same shape M2's editor reports. */
export interface ThemeProblem {
  readonly message: string;
  readonly at: JsonLocation | undefined;
}

export interface ThemeEditorSessionOptions {
  readonly theme?: ThemeDocument | undefined;
  /**
   * What the editor draws, when the shipped format is not the one in use.
   *
   * A host with their own theme format passes their own fields; a host with an extra entry
   * in the shipped one passes nothing, because an unrecognised key turns up as a row
   * anyway — see {@link themeRowsFor}.
   */
  readonly fields?: readonly ThemeField[] | undefined;
}

/**
 * A theme, edited as a form rather than as JSON — checklist M5.
 *
 * **It knows nothing about `@kajay/themes`, and cannot.** `creator-core` may depend on
 * `@kajay/core` and nothing else, so a theme here is the plain JSON object it always was
 * ([ADR-0008](../../../docs/adr/0008-css-variable-token-system.md)) and turning one into
 * CSS variables stays the host's call to `themeVariables`. That is the constraint doing
 * its job rather than getting in the way: the editor works on a host's own theme format
 * for exactly the same reason it works on the shipped one.
 *
 * **The live preview is composition, not a feature.** A host renders M3's `PreviewPanel`
 * with `themeVariables(session.theme)` and watches it change; nothing here draws a survey,
 * and no second preview exists to disagree with the first.
 *
 * **Not on the survey's undo stack**, deliberately. A theme is not part of the definition —
 * it is a fact about one deployment — so it has no business in a history of edits to the
 * document. {@link reset} and importing a file are the ways back.
 */
export class ThemeEditorSession {
  readonly #fields: readonly ThemeField[];
  readonly #opened: ThemeDocument;
  #theme: ThemeDocument;
  #problem: ThemeProblem | undefined;
  #version = 0;

  readonly onChanged: EventEmitter<number> = new EventEmitter();

  constructor(options: ThemeEditorSessionOptions = {}) {
    this.#fields = options.fields ?? BUILT_IN_THEME_FIELDS;
    this.#opened = options.theme ?? {};
    this.#theme = this.#opened;
  }

  get version(): number {
    return this.#version;
  }

  /** The theme as plain JSON. What a host hands to `themeVariables`. */
  get theme(): ThemeDocument {
    return this.#theme;
  }

  /** Every field to draw: the declared ones, then whatever the document holds besides. */
  get rows(): readonly ThemeRow[] {
    return themeRowsFor(this.#theme, this.#fields);
  }

  /** What went wrong with the last import. Cleared by the next thing that works. */
  get problem(): ThemeProblem | undefined {
    return this.#problem;
  }

  /** Whether anything has been changed since the theme was opened or a preset applied. */
  get isDirty(): boolean {
    return this.#theme !== this.#opened;
  }

  /**
   * Writes one field. An empty text **removes** it rather than blanking it.
   *
   * I2's rule, not a nicety: what a theme does not name, it does not set. A blanked
   * `cornerRadius` would reach the renderer as an empty CSS variable and override the
   * stylesheet's own default with nothing.
   */
  setValue(path: string, text: string): void {
    const field = this.rows.find((row) => row.path === path);
    const written = field?.kind === 'number' ? numberOrNothing(text) : text;
    const next = withValueAt(this.#theme, path, written);
    if (JSON.stringify(next) === JSON.stringify(this.#theme)) {
      return;
    }
    this.#theme = next;
    this.#announce();
  }

  /**
   * Swaps in a whole theme — a shipped preset, or one a host built.
   *
   * It **replaces rather than merges**, which is I3's finding in a different place: a
   * preset that left a colour out would inherit whatever the last theme set, and a preset
   * merged over the current theme does that to every field the new one does not name.
   */
  applyTheme(theme: ThemeDocument): void {
    this.#theme = theme;
    this.#problem = undefined;
    this.#announce();
  }

  /** Back to the theme this session opened with. */
  reset(): void {
    this.applyTheme(this.#opened);
  }

  /** The theme as a file. */
  toJson(): string {
    return JSON.stringify(this.#theme, undefined, 2);
  }

  /**
   * Reads a theme file. Says whether it took.
   *
   * Refuses anything that is not a JSON *object*, because a theme is a mapping and an
   * array or a number is a file somebody picked by mistake — applying it would blank every
   * variable the survey had.
   */
  applyJson(text: string): boolean {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const offset = syntaxErrorOffset(message);
      this.#problem = { message, at: offset === undefined ? undefined : locationOf(text, offset) };
      this.#announce();
      return false;
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      this.#problem = { message: 'A theme must be a JSON object.', at: undefined };
      this.#announce();
      return false;
    }
    this.applyTheme(value as ThemeDocument);
    return true;
  }

  #announce(): void {
    this.#version += 1;
    this.onChanged.emit(this.#version);
  }
}

/** `undefined` means "do not write", which is what a half-typed number is. */
function numberOrNothing(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}
