import { toClearPolicy } from './clearInvisibleAnswers.js';
import type { ClearInvisibleValues } from './clearInvisibleAnswers.js';
import { toPreviewMode } from './previewQuestions.js';
import type { PreviewMode } from './previewQuestions.js';
import { toProgressBarLocation, toProgressBarType } from './progressBar.js';
import type { ProgressBarLocation, ProgressBarType } from './progressBar.js';
import { SurveyElement } from './SurveyElement.js';
import { toTimerPanelLocation, toTimerPanelMode } from './SurveyTimer.js';
import type { TimerPanelLocation, TimerPanelMode } from './SurveyTimer.js';

/**
 * The survey's own authored properties, typed.
 *
 * A layer of its own because it is a different kind of thing from the rest of the root:
 * everything here reads or writes one entry in the property bag and knows nothing about
 * pages, logic or answers. Splitting it leaves `Survey` describing what a survey *is
 * made of* rather than doubling as the list of what an author may write on it — and
 * gives §J's localizable strings one place to arrive rather than a dozen.
 *
 * A base class rather than a separate object, because these are the survey's own
 * properties and reaching them through `survey.properties.title` would be a worse API
 * for the sake of a tidier file.
 */
export abstract class SurveyProperties extends SurveyElement {
  get title(): string {
    return this.getStringProperty('title');
  }

  set title(value: string) {
    this.setPropertyValue('title', value);
  }

  get description(): string {
    return this.getStringProperty('description');
  }

  set description(value: string) {
    this.setPropertyValue('description', value);
  }

  /** How the authored pages are presented: standard, singlePage or questionPerPage. */
  get questionsOnPageMode(): string {
    return this.getStringProperty('questionsOnPageMode');
  }

  set questionsOnPageMode(value: string) {
    this.setPropertyValue('questionsOnPageMode', value);
  }

  /**
   * Whether the whole survey is for reading rather than answering.
   *
   * Read by every question through the value host, so one flag turns a live form into a
   * printed one. Writing it goes through `setReadOnly`, which also tells the renderer —
   * a silent change here would leave a respondent typing into a survey that believes
   * nobody may.
   */
  get isReadOnly(): boolean {
    return this.getBooleanProperty('readOnly');
  }

  /**
   * Whether answering the last question on a page turns it.
   *
   * Only ever *forward*, and never off the last page — see `shouldAdvanceAutomatically`
   * for why submitting stays a deliberate act.
   */
  get goNextPageAutomatic(): boolean {
    return this.getBooleanProperty('goNextPageAutomatic');
  }

  /** Whether the first question on each page takes focus as the page arrives. */
  get autoFocusFirstQuestion(): boolean {
    return this.getBooleanProperty('autoFocusFirstQuestion');
  }

  /** Where the progress bar is drawn, if at all. */
  get showProgressBar(): ProgressBarLocation {
    return toProgressBarLocation(this.getStringProperty('showProgressBar'));
  }

  /** What the bar measures: pages behind them, or questions answered. */
  get progressBarType(): ProgressBarType {
    return toProgressBarType(this.getStringProperty('progressBarType'));
  }

  /** Whether the respondent gets a list of pages they can jump between. */
  get showTOC(): boolean {
    return this.getBooleanProperty('showTOC');
  }

  /** Whether the respondent sees their answers before submitting, and which of them. */
  get showPreviewBeforeComplete(): PreviewMode {
    return toPreviewMode(this.getStringProperty('showPreviewBeforeComplete'));
  }

  /** What happens to an answer the respondent can no longer reach. */
  get clearInvisibleValues(): ClearInvisibleValues {
    return toClearPolicy(this.getStringProperty('clearInvisibleValues'));
  }

  /** Seconds allowed for the whole survey. 0 — the default — means untimed. */
  get maxTimeToFinish(): number {
    return this.getNumberProperty('maxTimeToFinish');
  }

  /**
   * Seconds allowed for a page that does not state its own.
   *
   * A default rather than the limit itself, so a survey can put a clock on every page
   * and still let one long page have longer.
   */
  get maxTimeToFinishPage(): number {
    return this.getNumberProperty('maxTimeToFinishPage');
  }

  /** Where the timer panel is drawn, if at all. */
  get showTimerPanel(): TimerPanelLocation {
    return toTimerPanelLocation(this.getStringProperty('showTimerPanel'));
  }

  /** Which clocks the panel shows: this page's, the whole survey's, or both. */
  get showTimerPanelMode(): TimerPanelMode {
    return toTimerPanelMode(this.getStringProperty('showTimerPanelMode'));
  }
}
