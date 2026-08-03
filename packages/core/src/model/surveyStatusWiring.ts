import { clearAnswersOnComplete } from './clearInvisibleAnswers.js';
import type { Survey } from './Survey.js';
import type { SurveyStatusHost } from './SurveyStatus.js';

/** The half of the status host that only the survey internals can supply. */
export type StatusWiring = Pick<SurveyStatusHost, 'evaluate' | 'resolve' | 'announce'>;

/**
 * Assembles what the status object is allowed to see.
 *
 * Outside the class for the same reason the validation host is: everything here is
 * readable from the survey's own public surface, and a literal buried in a field
 * initializer is where "the ending may read any answer" would go unnoticed.
 */
export function createStatusHost(survey: Survey, wiring: StatusWiring): SurveyStatusHost {
  return {
    readProperty: (name) => {
      const value = survey.getResolvedProperty(name);
      return typeof value === 'string' ? value : '';
    },
    // Visible pages, not authored ones: a survey whose every page is conditioned away
    // has nothing to answer, whatever the definition contains.
    hasVisiblePages: () => survey.visiblePages.length > 0,
    conditions: () => survey.completedHtmlOnCondition,
    // Ordinary writes: the survey is ending, so there is no cascade for anyone to see
    // half of, and the host hears about each one as it would any other answer.
    clearAnswers: () => {
      clearAnswersOnComplete(survey, (name) => {
        survey.setValue(name, undefined);
      });
    },
    announceComplete: () => {
      survey.onComplete.emit({ data: survey.data });
    },
    ...wiring,
  };
}
