import { toClearPolicy } from './clearInvisibleAnswers.js';
import type { ClearInvisibleValues } from './clearInvisibleAnswers.js';
import { SurveyElement } from './SurveyElement.js';

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

  /** What happens to an answer the respondent can no longer reach. */
  get clearInvisibleValues(): ClearInvisibleValues {
    return toClearPolicy(this.getStringProperty('clearInvisibleValues'));
  }
}
