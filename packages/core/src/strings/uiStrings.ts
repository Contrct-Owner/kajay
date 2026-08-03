/**
 * Every string the library itself says — checklist J2.
 *
 * The catalogue is the source of its own key union, following the pattern ADR-0020 set
 * for diagnostic codes: adding a message means adding it here, and using a key that is
 * not here fails to compile. That is what makes "`en` is complete" a fact about the
 * build rather than a claim in a document — English cannot be missing an entry, because
 * the entry *is* the English.
 *
 * `{0}`-style placeholders, the same spelling `rowTitleFormat` already uses. Nothing
 * here interpolates an answer, so nothing here needs escaping: these are the library's
 * own words, and the values substituted into them are its own numbers and the names of
 * files a respondent chose.
 */
export const UI_STRING_DEFINITIONS = [
  // --- Validation, emitted by the model -----------------------------------
  { key: 'requiredAnswer', en: 'This question requires an answer.' },
  { key: 'expressionCondition', en: 'This answer does not meet the required condition.' },
  { key: 'selectMin', en: 'Please select at least {0} options.' },
  { key: 'selectMax', en: 'Please select no more than {0} options.' },
  { key: 'emailInvalid', en: 'Please enter a valid email address.' },
  { key: 'textMin', en: 'Please enter at least {0} characters.' },
  { key: 'textMax', en: 'Please enter no more than {0} characters.' },
  { key: 'textNoDigits', en: 'Please enter a value without digits.' },
  { key: 'numberInvalid', en: 'Please enter a number.' },
  { key: 'numberMin', en: 'Please enter a value no less than {0}.' },
  { key: 'numberMax', en: 'Please enter a value no greater than {0}.' },
  { key: 'regexInvalid', en: 'Please enter a value in the expected format.' },
  { key: 'commentTooLong', en: 'Please shorten this to {0} characters or fewer.' },
  { key: 'fileTooMany', en: 'Please attach no more than {0} files.' },
  { key: 'fileWrongType', en: '"{0}" is not one of the accepted file types ({1}).' },
  { key: 'fileTooLarge', en: '"{0}" is larger than {1}.' },

  // --- Progress, measured by the model ------------------------------------
  // A key per plural form rather than a rule, because a rule that worked for English
  // would be wrong for most languages. See the note below on what that does not cover.
  { key: 'progressPageOne', en: '{0} of {1} page completed' },
  { key: 'progressPageMany', en: '{0} of {1} pages completed' },
  { key: 'progressQuestionOne', en: '{0} of {1} question completed' },
  { key: 'progressQuestionMany', en: '{0} of {1} questions completed' },
  { key: 'progressCorrect', en: '{0} of {1} correct' },

  // --- Navigation and survey states ---------------------------------------
  { key: 'nextPage', en: 'Next' },
  { key: 'prevPage', en: 'Previous' },
  { key: 'complete', en: 'Complete' },
  { key: 'preview', en: 'Check your answers' },
  { key: 'editAnswers', en: 'Edit answers' },
  { key: 'validating', en: 'Checking…' },
  { key: 'loading', en: 'Loading…' },
  { key: 'emptySurvey', en: 'This survey has no questions to answer.' },
  { key: 'completedThanks', en: 'Thank you for completing this survey.' },
  { key: 'tableOfContents', en: 'Survey pages' },

  // --- Question types -----------------------------------------------------
  { key: 'loadMoreOptions', en: 'Load more options' },
  { key: 'loadingOptions', en: 'Loading options…' },
  { key: 'allOptionsLoaded', en: 'That is every option.' },
  { key: 'filterOptions', en: 'Filter options' },
  { key: 'chooseRating', en: 'Choose a rating' },
  { key: 'charactersRemaining', en: '{0} characters remaining' },
  { key: 'reorderHint', en: 'Drag or use the keyboard to reorder' },
  {
    key: 'reorderKeyboardHint',
    en: 'Press space to pick this up, then use the arrow keys to move it and space again to drop it.',
  },
  { key: 'rankChoices', en: 'Choices' },
  { key: 'rankYours', en: 'Your ranking' },
  { key: 'rankEmpty', en: 'Nothing ranked yet.' },
  { key: 'rankFull', en: 'Everything has been ranked.' },
  { key: 'rankOption', en: 'Rank {0}' },
  { key: 'uploading', en: 'Uploading…' },
  { key: 'removeFile', en: 'Remove {0}' },
  { key: 'clearSignature', en: 'Clear signature' },
  { key: 'notSigned', en: 'not yet signed' },

  // --- Timer panel --------------------------------------------------------
  { key: 'timerPage', en: 'Page' },
  { key: 'timerSurvey', en: 'Survey' },
  { key: 'timerRemaining', en: 'remaining' },
  { key: 'timerElapsed', en: 'elapsed' },
] as const;

/** Every key the library may ask for. Using one that is not here fails to compile. */
export type UiStringKey = (typeof UI_STRING_DEFINITIONS)[number]['key'];

/** What a locale supplies. Partial: an untranslated key falls back rather than breaking. */
export type UiStrings = Partial<Readonly<Record<UiStringKey, string>>>;

/** The complete English table, built from the catalogue so it cannot fall behind it. */
export const EN_STRINGS: UiStrings = Object.fromEntries(
  UI_STRING_DEFINITIONS.map((definition) => [definition.key, definition.en]),
);

/** Substitutes `{0}`, `{1}` … A placeholder with no argument is left as written. */
export function formatUiString(template: string, params: readonly (string | number)[]): string {
  return template.replaceAll(/\{(\d+)\}/gu, (match, index: string) => {
    const value = params[Number(index)];
    return value === undefined ? match : String(value);
  });
}
