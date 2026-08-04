/**
 * Every word the Creator itself says — checklist N3.
 *
 * **The catalogue is the source of its own key union**, which is J2's pattern for the
 * runtime's words and ADR-0020's for diagnostic codes: adding a label means adding it here,
 * and using a key that is not here fails to compile. That is what makes "English is
 * complete" a fact about the build rather than a claim in a document — English cannot be
 * missing an entry, because the entry *is* the English.
 *
 * **A separate catalogue from the runtime's**, deliberately. A respondent never sees any of
 * these and a designer never sees "This question requires an answer"; one table would mean
 * every host translating a survey also read forty strings about drag handles, and every
 * host translating a Creator read fifty about validation. The two audiences are different
 * people, usually in different languages.
 *
 * `{0}`-style placeholders, the same spelling the runtime uses. Nothing here interpolates
 * anything a respondent wrote — these are the Creator's own words about a designer's own
 * survey — so nothing here needs escaping.
 */
export const CREATOR_STRING_DEFINITIONS = [
  // --- The assembly ---------------------------------------------------------
  { key: 'tabDesign', en: 'Design' },
  { key: 'tabPreview', en: 'Preview' },
  { key: 'tabLogic', en: 'Logic' },
  { key: 'tabJson', en: 'JSON' },
  { key: 'tabTranslations', en: 'Translations' },
  { key: 'tabTheme', en: 'Theme' },
  { key: 'creatorViews', en: 'Creator views' },
  { key: 'save', en: 'Save' },
  { key: 'saving', en: 'Saving…' },
  { key: 'saved', en: 'Saved' },
  { key: 'saveFailed', en: 'Save failed — try again' },

  // --- The toolbox ----------------------------------------------------------
  { key: 'toolboxSearch', en: 'Search the toolbox' },
  { key: 'toolboxSearchPlaceholder', en: 'Search' },
  { key: 'toolboxNoMatches', en: 'Nothing matches “{0}”.' },
  { key: 'categoryText', en: 'Text' },
  { key: 'categoryChoice', en: 'Choice' },
  { key: 'categoryMatrix', en: 'Matrix' },
  { key: 'categoryPanels', en: 'Panels' },
  { key: 'categoryMedia', en: 'Media' },
  { key: 'categoryDisplay', en: 'Display' },
  { key: 'categoryOther', en: 'Other' },

  // --- The canvas -----------------------------------------------------------
  { key: 'undo', en: 'Undo' },
  { key: 'redo', en: 'Redo' },
  { key: 'addPage', en: 'Add page' },
  { key: 'surveySettings', en: 'Survey' },
  { key: 'emptySurvey', en: 'This survey has no pages yet.' },
  { key: 'duplicate', en: 'Duplicate' },
  { key: 'copy', en: 'Copy' },
  { key: 'paste', en: 'Paste' },
  { key: 'delete', en: 'Delete' },
  { key: 'selectElement', en: 'Select {0}' },
  { key: 'moveElement', en: 'Move {0}' },
  { key: 'deleteElement', en: 'Delete {0}' },
  { key: 'titleOf', en: 'Title of {0}' },
  { key: 'typeOf', en: 'Type of {0}' },
  { key: 'sortableItem', en: 'Sortable item' },

  // --- The property grid ----------------------------------------------------
  { key: 'nothingSelected', en: 'Select a question or a page to edit it.' },
  { key: 'sectionGeneral', en: 'General' },
  { key: 'sectionLogic', en: 'Logic' },
  { key: 'sectionValidation', en: 'Validation' },
  { key: 'sectionLayout', en: 'Layout' },
  { key: 'sectionData', en: 'Data' },
  { key: 'translationsOf', en: '{0} in other languages' },

  // --- The logic editor -----------------------------------------------------
  { key: 'logicEmpty', en: 'This survey has no logic yet.' },
  { key: 'logicAddRule', en: 'Add rule' },
  { key: 'logicRemoveRule', en: 'Remove rule' },
  { key: 'logicAddCondition', en: 'Add condition' },
  { key: 'logicCondition', en: 'Condition' },
  { key: 'logicRawNote', en: 'This condition is more than a row of comparisons, so it is edited as text.' },
  { key: 'logicNewAction', en: 'What the new rule does' },
  { key: 'logicNewSubject', en: 'What the new rule acts on' },
  { key: 'logicAll', en: 'all of these' },
  { key: 'logicAny', en: 'any of these' },
  { key: 'logicWhen', en: 'when' },
  { key: 'actionShow', en: 'Show' },
  { key: 'actionEnable', en: 'Enable' },
  { key: 'actionRequire', en: 'Require' },
  { key: 'actionSetValue', en: 'Set value of' },
  { key: 'actionClearValue', en: 'Clear value of' },
  { key: 'actionSkip', en: 'Skip to' },
  { key: 'actionComplete', en: 'Complete the survey' },
  { key: 'actionCopyValue', en: 'Copy value into' },
  { key: 'actionRunExpression', en: 'Run expression into' },

  // --- The JSON editor ------------------------------------------------------
  { key: 'jsonDefinition', en: 'Survey definition' },
  { key: 'jsonApply', en: 'Apply' },
  { key: 'jsonRevert', en: 'Revert' },
  { key: 'jsonStale', en: 'The designer has changed since you started editing. Applying will replace it.' },

  // --- The preview ----------------------------------------------------------
  { key: 'previewDevice', en: 'Preview device' },
  { key: 'previewRotate', en: 'Rotate' },
  { key: 'previewRestart', en: 'Restart' },
  { key: 'previewStale', en: 'The design has changed since this run started. Restart to see it.' },
  { key: 'deviceResponsive', en: 'Responsive' },
  { key: 'devicePhone', en: 'Phone' },
  { key: 'deviceTablet', en: 'Tablet' },
  { key: 'deviceDesktop', en: 'Desktop' },

  // --- The translation editor ----------------------------------------------
  { key: 'translationString', en: 'String' },
  { key: 'translationCount', en: '{0} strings' },
  { key: 'translationMissing', en: '({0} missing)' },
  { key: 'translationAddLanguage', en: 'Add language' },
  { key: 'translationLanguageToAdd', en: 'Language to add' },
  { key: 'translationTarget', en: 'Language to translate into' },
  { key: 'translationTranslate', en: 'Machine translate' },
  { key: 'translationTranslating', en: 'Translating…' },
  { key: 'translationFilled', en: 'Filled {0} strings into {1}.' },
  { key: 'translationCell', en: '{0} in {1}' },

  // --- The theme editor -----------------------------------------------------
  { key: 'themeReset', en: 'Reset' },
  { key: 'themeNotSet', en: '(not set)' },
] as const;

/** Every key the Creator can say. Using one that is not above fails to compile. */
export type CreatorStringKey = (typeof CREATOR_STRING_DEFINITIONS)[number]['key'];

/** A language's worth of Creator words. Partial: a host may translate some and not others. */
export type CreatorStrings = Partial<Record<CreatorStringKey, string>>;

/**
 * The English, built from the catalogue so it cannot fall out of step with the keys.
 *
 * **Complete**, and typed as such, which is what lets the dictionary's last fallback be
 * total rather than a guard: there is no key English can be missing, because the key and
 * the English are the same table entry. A `?? key` beside that guarded against nothing —
 * a mutant proved it — and logic no test can reach is logic nobody has checked.
 */
export const EN_CREATOR_STRINGS: Readonly<Record<CreatorStringKey, string>> = Object.fromEntries(
  CREATOR_STRING_DEFINITIONS.map((definition) => [definition.key, definition.en]),
) as Readonly<Record<CreatorStringKey, string>>;

/**
 * Substitutes `{0}`, `{1}` … into a template.
 *
 * A missing parameter leaves its placeholder alone rather than printing `undefined`: a
 * label reading "Filled {0} strings" is obviously a bug, and one reading "Filled undefined
 * strings" looks like a number that went wrong somewhere else.
 */
export function formatCreatorString(
  template: string,
  parameters: readonly (string | number)[],
): string {
  return template.replaceAll(/\{(\d+)\}/gu, (placeholder, index: string) => {
    const value = parameters[Number(index)];
    return value === undefined ? placeholder : String(value);
  });
}
