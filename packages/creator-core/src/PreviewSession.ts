import { EventEmitter, parseSurvey } from '@kajay/core';
import type {
  Diagnostic,
  MetadataRegistry,
  ParseOptions,
  Survey,
  SurveyDefinition,
} from '@kajay/core';
import type { DesignSurface } from './DesignSurface.js';
import {
  DEFAULT_PREVIEW_DEVICE,
  previewDevice,
  previewViewport,
} from './previewDevices.js';
import type { PreviewDevice, PreviewOrientation, PreviewViewport } from './previewDevices.js';

/** Answers to start a run with — checklist M3's test data. */
export type PreviewData = Readonly<Record<string, unknown>>;

export interface PreviewSessionOptions {
  readonly registry?: MetadataRegistry | undefined;
  /**
   * The host's own seams, exactly as a respondent's survey gets them.
   *
   * Passed through rather than omitted, and this is the difference between a preview and
   * a picture of one: a survey whose choices come from a URL (B10), whose expressions call
   * a host function (B2), or whose file question uploads somewhere (H1) is not being
   * previewed at all if those are missing. A designer would be testing the parts that
   * happen to need nothing.
   */
  readonly parse?: ParseOptions | undefined;
  readonly device?: string | undefined;
  readonly data?: PreviewData | undefined;
}

/**
 * A run of the survey being designed — checklist M3.
 *
 * **Its own parse, and that is the whole design.** The canvas holds a survey in design
 * mode, where every question reports itself read-only (E7) and a click cannot record an
 * answer. A preview has to be the opposite, and it must not be able to write into the
 * document being designed either — so it is a *separate* `Survey`, parsed from a snapshot
 * of the definition. Answers live and die with the session; the design never sees them.
 *
 * That also means the preview exercises `parseSurvey` the way a respondent's browser will,
 * which is the point of previewing at all: the logic graph is rebuilt, validators are
 * registered, and defaults are applied. Property edits on the canvas mutate the model in
 * place and do *not* rebuild the logic graph (§L1's named gap) — restarting here is what
 * makes an edited `visibleIf` real.
 *
 * **A restart is automatic while there is nothing to lose.** A designer who tweaks a title
 * and looks at the preview should see the new title, not a notice about it; a designer who
 * has filled in three pages should not have that thrown away because somebody fixed a
 * typo. "Nothing answered yet" is exactly the line between those, so that is the line.
 */
export class PreviewSession {
  readonly #surface: DesignSurface;
  readonly #options: PreviewSessionOptions;
  readonly #unsubscribe: () => void;
  #snapshot: SurveyDefinition;
  #survey: Survey;
  #diagnostics: readonly Diagnostic[];
  #data: PreviewData;
  #device: string;
  #orientation: PreviewOrientation = 'portrait';
  #isTouched = false;
  #runCount = 0;
  #version = 0;
  /** Memoised staleness, keyed on the surface version that produced it. */
  #staleAt: { version: number; isStale: boolean } | undefined;

  readonly onChanged: EventEmitter<number> = new EventEmitter();

  constructor(surface: DesignSurface, options: PreviewSessionOptions = {}) {
    this.#surface = surface;
    this.#options = options;
    this.#data = options.data ?? {};
    this.#device = options.device ?? DEFAULT_PREVIEW_DEVICE;
    this.#snapshot = surface.definition;
    const run = this.#start(this.#snapshot);
    this.#survey = run.survey;
    this.#diagnostics = run.diagnostics;
    this.#unsubscribe = surface.onChanged.add(() => {
      this.#followDesign();
    });
  }

  /** The survey a respondent would be answering. Not the one on the canvas. */
  get survey(): Survey {
    return this.#survey;
  }

  /** What was wrong with the definition being previewed. Never thrown away silently. */
  get diagnostics(): readonly Diagnostic[] {
    return this.#diagnostics;
  }

  get version(): number {
    return this.#version;
  }

  /**
   * Which run this is. Advances on a restart, and on nothing else.
   *
   * Separate from {@link version}, which advances whenever *anything* changes — the device,
   * the orientation, the first answer. A view that remounted the survey on that would tear
   * the page out from under somebody the moment they typed into it, so the two counters are
   * two different questions: "redraw" and "this is a different survey now".
   */
  get run(): number {
    return this.#runCount;
  }

  /**
   * Whether the design has moved on since this run started.
   *
   * Compared as *definitions* rather than by the surface's version counter, which also
   * advances when a designer merely clicks a question — a preview that announced itself
   * stale because somebody changed the selection would be crying wolf on every click.
   *
   * Memoised on that counter all the same, so the comparison happens once per change
   * rather than once per render.
   */
  get isStale(): boolean {
    const version = this.#surface.version;
    if (this.#staleAt?.version !== version) {
      this.#staleAt = {
        version,
        isStale: JSON.stringify(this.#surface.definition) !== JSON.stringify(this.#snapshot),
      };
    }
    return this.#staleAt.isStale;
  }

  /** Whether anybody has answered, turned a page, or finished it. */
  get isTouched(): boolean {
    return this.#isTouched;
  }

  /** Starts the survey again from the current design, with the test data seeded. */
  restart(): void {
    this.#snapshot = this.#surface.definition;
    this.#staleAt = undefined;
    const run = this.#start(this.#snapshot);
    this.#survey = run.survey;
    this.#diagnostics = run.diagnostics;
    this.#announce();
  }

  /**
   * Follows an edit when the run has nothing to lose, and says so when it has.
   *
   * Not a silent reparse either way: a designer three pages into a run has state worth
   * more than the edit is, and one who has answered nothing wants the edit.
   */
  #followDesign(): void {
    if (!this.#isTouched && this.isStale) {
      this.restart();
      return;
    }
    // The notice is drawn from `isStale`, which has just changed. Nothing else has, so
    // this is a redraw rather than a restart.
    this.#announce();
  }

  /** The answers a run starts with — checklist M3's test data. */
  get testData(): PreviewData {
    return this.#data;
  }

  /**
   * Seeds the answers and starts again.
   *
   * Restarting rather than writing into the survey in flight, because seeded answers are
   * the *premise* of a run — a `visibleIf` that has already decided a page is not shown
   * would have to be re-decided anyway, and half-applying data is how a preview ends up
   * in a state the survey could not have reached on its own.
   */
  setTestData(data: PreviewData): void {
    this.#data = data;
    this.restart();
  }

  /** What the run has recorded so far, which is what a host would submit. */
  get data(): Readonly<Record<string, unknown>> {
    return this.#survey.data;
  }

  get device(): PreviewDevice {
    return previewDevice(this.#device);
  }

  setDevice(name: string): void {
    if (this.#device === name) {
      return;
    }
    this.#device = name;
    // Deliberately *not* a restart: how big the window is has nothing to do with what has
    // been answered, and throwing away a half-filled run to look at it on a phone would
    // make the one question the preset exists to answer the hardest one to ask.
    this.#announce();
  }

  get orientation(): PreviewOrientation {
    return this.#orientation;
  }

  setOrientation(orientation: PreviewOrientation): void {
    if (this.#orientation === orientation) {
      return;
    }
    this.#orientation = orientation;
    this.#announce();
  }

  /** What the frame should measure. `undefined` on an axis means "fill what it is given". */
  get viewport(): PreviewViewport {
    return previewViewport(this.device, this.#orientation);
  }

  /** Stops following the design. A host that discards a session should call this. */
  dispose(): void {
    this.#unsubscribe();
  }

  #start(definition: SurveyDefinition): { survey: Survey; diagnostics: readonly Diagnostic[] } {
    this.#runCount += 1;
    const parsed =
      this.#options.registry === undefined
        ? parseSurvey(definition, this.#options.parse ?? {})
        : parseSurvey(definition, this.#options.registry, this.#options.parse ?? {});
    // Never `setDesignMode`: this is the run, not the canvas.
    this.#isTouched = false;
    if (Object.keys(this.#data).length > 0) {
      parsed.survey.setData(this.#data);
    }
    // **Listened to after the seed**, which is what makes test data the premise of a run
    // rather than the first thing anybody answered. Arming the flag earlier or later
    // changes nothing; attaching these before `setData` would mark a seeded session
    // touched on arrival, and it could then never follow an edit.
    parsed.survey.onValueChanged.add(() => {
      this.#touch();
    });
    parsed.survey.onCurrentPageChanged.add(() => {
      this.#touch();
    });
    parsed.survey.onComplete.add(() => {
      this.#touch();
    });
    return parsed;
  }

  #touch(): void {
    if (!this.#isTouched) {
      this.#isTouched = true;
      this.#announce();
    }
  }

  #announce(): void {
    this.#version += 1;
    this.onChanged.emit(this.#version);
  }
}
