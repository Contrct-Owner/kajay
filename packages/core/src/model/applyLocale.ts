import { RepeatingQuestion } from './RepeatingQuestion.js';
import type { Survey } from './Survey.js';

/**
 * Switches the language the survey is read in — checklist J1.
 *
 * Announces only a real change. Re-announcing the locale a survey is already in would
 * re-render every question in it for nothing.
 *
 * The scope is **mutated, not replaced**: every element in the survey holds a reference
 * to that one object, which is what makes a switch instantaneous everywhere instead of
 * a walk that can miss a collection.
 *
 * Repeating instances are then thrown away and rebuilt. A cell's title is composed at
 * build time — "Traveller 2, Name" — out of the template's *resolved* title, so an
 * instance made in English stays English however carefully the templates are
 * re-resolved. This is the only thing in the model that caches a translated string, and
 * this line is why it is allowed to.
 */
export function applyLocale(survey: Survey, locale: string): void {
  if (survey.localeScope.locale === locale) {
    return;
  }
  survey.localeScope.locale = locale;
  for (const question of survey.questions) {
    if (question instanceof RepeatingQuestion) {
      question.rebuildInstances();
    }
  }
  survey.onLocaleChanged.emit({ locale });
}
