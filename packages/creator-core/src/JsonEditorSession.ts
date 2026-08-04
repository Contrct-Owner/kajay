import { EventEmitter, parseSurvey } from '@kajay/core';
import type { Diagnostic, MetadataRegistry, SurveyDefinition } from '@kajay/core';
import type { DesignSurface } from './DesignSurface.js';
import { locationOf, syntaxErrorOffset } from './jsonLocation.js';
import type { JsonLocation } from './jsonLocation.js';

/**
 * Why a draft cannot become a survey at all.
 *
 * `syntax` is `JSON.parse` refusing the text; `rejected` is `parseSurvey` refusing the
 * value — a root that is not an object, or a `schemaVersion` from a future this build does
 * not know. Two kinds rather than one because they are answerable differently: the first
 * has a place in the text, and the second is about the document as a whole.
 */
export interface JsonEditorProblem {
  readonly kind: 'syntax' | 'rejected';
  readonly message: string;
  /** Where in the draft, when the error says. Never invented — see `jsonLocation`. */
  readonly at: JsonLocation | undefined;
}

export interface JsonEditorSessionOptions {
  readonly registry?: MetadataRegistry | undefined;
  /** How the JSON is laid out. Two spaces unless a host says otherwise. */
  readonly indent?: number | undefined;
}

/**
 * The definition as text, edited directly — checklist M2.
 *
 * **Two-way, and the two ways are not symmetrical.** Designer to text is free: the
 * definition is already what `serializeSurvey` produces, so the draft is re-seeded from it
 * whenever the designer changes something. Text to designer goes through
 * {@link DesignSurface.applyEdit}, which means a hand-edited definition is re-parsed,
 * validated and **undoable** exactly like a drag — the return on
 * [ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md) decision 3 one more time.
 *
 * **A draft is followed only while it is clean.** M3 drew this line for the preview and it
 * is the same line here: a designer who has typed nothing loses nothing by being re-seeded,
 * and one who is halfway through hand-writing a matrix must not have it overwritten because
 * somebody dragged a question on the canvas. When both have moved, the session says so and
 * the designer chooses.
 *
 * **Diagnostics do not block applying, and that is deliberate.** `parseSurvey` is total: it
 * recovers, keeps what it does not understand ([ADR-0002](../../../docs/adr/0002-round-trip-fixed-point.md)
 * rule 3) and reports. Refusing a definition the library itself accepts would make this tab
 * a *second opinion* about what a valid survey is — stricter than the file the host loaded
 * at startup, and unable to open a survey the runtime runs happily. So they are surfaced,
 * live, and applying is blocked only when there is no definition to apply.
 */
export class JsonEditorSession {
  readonly #surface: DesignSurface;
  readonly #options: JsonEditorSessionOptions;
  readonly #unsubscribe: () => void;
  #text: string;
  /** The definition the draft was seeded from, as text. What "clean" is measured against. */
  #seeded: string;
  #version = 0;

  readonly onChanged: EventEmitter<number> = new EventEmitter();

  constructor(surface: DesignSurface, options: JsonEditorSessionOptions = {}) {
    this.#surface = surface;
    this.#options = options;
    this.#seeded = this.#format(surface.definition);
    this.#text = this.#seeded;
    this.#unsubscribe = surface.onChanged.add(() => {
      this.#followDesign();
    });
  }

  get text(): string {
    return this.#text;
  }

  get version(): number {
    return this.#version;
  }

  /** Whether the draft has been edited since it was last seeded or applied. */
  get isDirty(): boolean {
    return this.#text !== this.#seeded;
  }

  /**
   * Whether the designer has moved on since the draft was seeded.
   *
   * **This is the "you both changed it" case and nothing else**, without needing to say
   * so: a clean draft is re-seeded the instant the designer changes anything, so the seed
   * can only fall behind while somebody is typing. A `isDirty &&` guard beside this read
   * as if it were doing something and no mutation could reach it — which is E7's lesson
   * about logic no test can get to, so it is not here.
   */
  get isStale(): boolean {
    return this.#format(this.#surface.definition) !== this.#seeded;
  }

  setText(text: string): void {
    if (this.#text === text) {
      return;
    }
    this.#text = text;
    this.#announce();
  }

  /**
   * What stops the draft becoming a survey, if anything.
   *
   * Recomputed per read rather than cached: it is asked once per render and `JSON.parse`
   * on a survey-sized document is not the expensive part of drawing an editor. A cache
   * here would be a second thing to keep in step with the text.
   */
  get problem(): JsonEditorProblem | undefined {
    return this.#read().problem;
  }

  /** What the library would say about this definition. Warnings included — see the class. */
  get diagnostics(): readonly Diagnostic[] {
    return this.#read().diagnostics;
  }

  get canApply(): boolean {
    return this.#read().definition !== undefined;
  }

  /**
   * Pushes the draft into the designer. Says whether it took.
   *
   * Through `applyEdit`, so hand-editing the JSON is one undo away from being taken back —
   * which matters more here than anywhere else in the Creator, because this is the one
   * surface where a designer can change the whole survey in a keystroke.
   */
  apply(): boolean {
    const definition = this.#read().definition;
    if (definition === undefined) {
      return false;
    }
    const before = this.#surface.definition;
    this.#surface.applyEdit(definition, { from: before });
    // Re-seeded from what the *surface* now holds rather than from the draft: applying a
    // definition canonicalises it (ADR-0002), so the text a designer typed and the text
    // that survived are not the same string, and calling the draft clean without saying
    // so would leave the editor showing something the survey no longer says.
    this.#reseed();
    return true;
  }

  /** Throws the draft away and shows what the designer has. */
  revert(): void {
    this.#reseed();
  }

  /** Stops following the designer. A host that discards a session should call this. */
  dispose(): void {
    this.#unsubscribe();
  }

  #followDesign(): void {
    if (this.isDirty) {
      // Somebody is mid-sentence. `isStale` is now true, which is the whole of what a
      // view needs; overwriting the draft here would be the Creator deleting typing.
      this.#announce();
      return;
    }
    this.#reseed();
  }

  #reseed(): void {
    this.#seeded = this.#format(this.#surface.definition);
    this.#text = this.#seeded;
    this.#announce();
  }

  /**
   * The draft as a definition, plus everything wrong with it.
   *
   * One function because the three answers come from one attempt: text that will not parse
   * has no diagnostics to report, and a value the parser rejects outright has no definition
   * to apply. Splitting them into three getters would parse the document three times per
   * render to produce answers that must agree.
   */
  #read(): {
    definition: SurveyDefinition | undefined;
    problem: JsonEditorProblem | undefined;
    diagnostics: readonly Diagnostic[];
  } {
    let value: unknown;
    try {
      value = JSON.parse(this.#text);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const offset = syntaxErrorOffset(message);
      return {
        definition: undefined,
        problem: {
          kind: 'syntax',
          message,
          at: offset === undefined ? undefined : locationOf(this.#text, offset),
        },
        diagnostics: [],
      };
    }
    return this.#trialParse(value);
  }

  /**
   * Parses for its diagnostics and throws the survey away.
   *
   * The survey built here is never shown: applying re-parses through `applyEdit`, and a
   * second live model of the same definition is exactly the kind of thing that ends up on
   * screen by accident. What is wanted is the *report*.
   */
  #trialParse(value: unknown): {
    definition: SurveyDefinition | undefined;
    problem: JsonEditorProblem | undefined;
    diagnostics: readonly Diagnostic[];
  } {
    try {
      const parsed =
        this.#options.registry === undefined
          ? parseSurvey(value)
          : parseSurvey(value, this.#options.registry);
      return {
        definition: value as SurveyDefinition,
        problem: undefined,
        diagnostics: parsed.diagnostics,
      };
    } catch (error) {
      // `parseSurvey` throws rather than reporting for the two things that are not a
      // survey at all: a root that is not an object, and a schema version from a future
      // this build cannot read. Neither has a place in the text to point at.
      return {
        definition: undefined,
        problem: {
          kind: 'rejected',
          message: error instanceof Error ? error.message : String(error),
          at: undefined,
        },
        diagnostics: [],
      };
    }
  }

  #format(definition: SurveyDefinition): string {
    return JSON.stringify(definition, undefined, this.#options.indent ?? 2);
  }

  #announce(): void {
    this.#version += 1;
    this.onChanged.emit(this.#version);
  }
}
