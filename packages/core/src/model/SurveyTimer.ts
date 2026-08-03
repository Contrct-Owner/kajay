/** Where the timer panel is drawn, if at all. */
export type TimerPanelLocation = 'none' | 'top' | 'bottom';

/** Which clocks the panel shows. */
export type TimerPanelMode = 'page' | 'survey' | 'all';

export function toTimerPanelLocation(declared: string): TimerPanelLocation {
  return declared === 'top' || declared === 'bottom' ? declared : 'none';
}

export function toTimerPanelMode(declared: string): TimerPanelMode {
  return declared === 'page' || declared === 'survey' ? declared : 'all';
}

/** One clock's reading, in whole seconds. */
export interface TimerReading {
  readonly elapsed: number;
  /** The limit, or 0 when this clock counts up without one. */
  readonly limit: number;
  /** Seconds left, or `undefined` when there is no limit to be left of. */
  readonly remaining: number | undefined;
}

const NOT_STARTED: TimerReading = { elapsed: 0, limit: 0, remaining: undefined };

/** What the timer needs from the survey, and what it does when a clock runs out. */
export interface TimerHost {
  readonly now: () => Date;
  /** Seconds allowed for the whole survey. 0 for no limit. */
  readonly surveyLimit: () => number;
  /** Seconds allowed for the page the respondent is on. 0 for no limit. */
  readonly pageLimit: () => number;
  readonly isCompleted: () => boolean;
  readonly onPageExpired: () => void;
  readonly onSurveyExpired: () => void;
}

/**
 * The survey's clocks — checklist E8.
 *
 * **It owns no interval.** Core is I/O-free by rule, and a model that scheduled its own
 * callbacks would make every timed test a race and every timed conformance case
 * unrepeatable. Instead the host calls `tick` — once a second from a renderer, or as
 * fast as a test likes — and everything the timer reports is computed from an injected
 * clock at the moment it is asked. Time therefore passes whether or not anybody ticks,
 * which is the honest behaviour: a respondent who backgrounds the tab has not paused
 * the exam.
 *
 * Nothing here emits an event. A number changing on screen is not a change to the
 * survey, and announcing one every second would re-render every question in it; the
 * panel re-renders itself. Expiry *is* a change, and it reaches listeners through the
 * navigation and completion events it causes rather than through a timer event of its
 * own — so a host that already handles completion needs to learn nothing new.
 */
export class SurveyTimer {
  readonly #host: TimerHost;
  #surveyStartedAt: number | undefined;
  #pageStartedAt: number | undefined;

  constructor(host: TimerHost) {
    this.#host = host;
  }

  /**
   * Starts both clocks. Starting a running timer does nothing.
   *
   * Started by the host rather than at construction: a survey parsed on a server to
   * score a stored response is not being sat by anybody, and a clock that began when the
   * object did would have that response arrive minutes over its limit.
   */
  start(): void {
    if (this.isRunning) {
      return;
    }
    const startedAt = this.#host.now().getTime();
    this.#surveyStartedAt = startedAt;
    this.#pageStartedAt = startedAt;
  }

  stop(): void {
    this.#surveyStartedAt = undefined;
    this.#pageStartedAt = undefined;
  }

  get isRunning(): boolean {
    return this.#surveyStartedAt !== undefined;
  }

  /** Begins the page clock again, leaving the survey clock alone. */
  restartPage(): void {
    if (this.isRunning) {
      this.#pageStartedAt = this.#host.now().getTime();
    }
  }

  get surveyTime(): TimerReading {
    return this.#read(this.#surveyStartedAt, this.#host.surveyLimit());
  }

  get pageTime(): TimerReading {
    return this.#read(this.#pageStartedAt, this.#host.pageLimit());
  }

  /**
   * Reads the clocks, and acts if either has run out.
   *
   * The survey's limit is checked first and ends the survey outright: when there is no
   * time left at all, turning the page instead would leave the respondent on a fresh
   * page of a survey that is already over.
   *
   * Neither path runs validation. A page whose time is up must be leavable even though
   * a required answer is missing — refusing to advance would strand the respondent on an
   * expired page with no way forward — and when the whole survey expires, the paper is
   * handed in as it stands. That is what a deadline means.
   */
  tick(): void {
    if (!this.isRunning || this.#host.isCompleted()) {
      return;
    }
    if (hasExpired(this.surveyTime)) {
      this.stop();
      this.#host.onSurveyExpired();
      return;
    }
    if (hasExpired(this.pageTime)) {
      // No `restartPage()` here. Every way out of an expired page restarts the clock on
      // its own — turning the page announces a page change, and the two endings that do
      // not turn a page (the preview, and completion) leave no page being answered, so
      // the limit stops applying at all. A restart here as well would be a line no test
      // could reach.
      this.#host.onPageExpired();
    }
  }

  #read(startedAt: number | undefined, limit: number): TimerReading {
    if (startedAt === undefined) {
      return limit > 0 ? { elapsed: 0, limit, remaining: limit } : NOT_STARTED;
    }
    // Floored, so a clock reads 0 for the whole of its first second rather than
    // rounding up to 1 the instant it starts.
    const elapsed = Math.max(0, Math.floor((this.#host.now().getTime() - startedAt) / 1000));
    return {
      elapsed,
      limit,
      remaining: limit > 0 ? Math.max(0, limit - elapsed) : undefined,
    };
  }
}

function hasExpired(reading: TimerReading): boolean {
  return reading.remaining === 0;
}
