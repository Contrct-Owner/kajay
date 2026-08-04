// The entire public surface of @kajay/creator-core. Anything not re-exported here is
// private, and there are no subpath entries (ADR-0010) — this file *is* the package.

export { DesignSurface } from './DesignSurface.js';
export type { DesignSurfaceOptions, EditOptions } from './DesignSurfaceOptions.js';
export { addPageTo, placeOn, removePageFrom } from './designerEdits.js';
export { allowedToolboxItems, isTypeAllowed } from './CreatorConfiguration.js';
export type { CreatorConfiguration } from './CreatorConfiguration.js';
export { CreatorStringDictionary } from './CreatorStringDictionary.js';
export {
  CREATOR_STRING_DEFINITIONS,
  EN_CREATOR_STRINGS,
  formatCreatorString,
} from './creatorStrings.js';
export type { CreatorStringKey, CreatorStrings } from './creatorStrings.js';
export { DesignSelection } from './DesignSelection.js';
export {
  canConvert,
  convertibleTypes,
  convertIn,
  copyFrom,
  duplicateIn,
  pasteInto,
  removeElementFrom,
} from './elementEdits.js';
export { freshenFragment, renameThroughout, takenNames } from './fragments.js';
export {
  DEFAULT_LOCALE_KEY,
  editorKindFor,
  humanizePropertyName,
  localesOf,
  localizedTextIn,
  parseEditorText,
  propertyRowsFor,
} from './propertyGrid.js';
export type {
  PropertyCommit,
  PropertyEditorKind,
  PropertyGridCategory,
  PropertyRow,
} from './propertyGrid.js';
export { renameIn, setLocalizedOn, setPropertyOn } from './propertyEdits.js';
export { conditionOutcome, propertyScopeOf } from './propertyConditions.js';
export {
  categoryFor,
  isHidden,
  NO_GRID_OPTIONS,
  orderCategories,
  orderRows,
  titleOverride,
} from './propertyGridOptions.js';
export type { PropertyGridOptions } from './propertyGridOptions.js';
export {
  applySuggestion,
  expressionSuggestions,
  matchingSuggestions,
  tokenAt,
} from './expressionSuggestions.js';
export type {
  ExpressionSuggestion,
  SuggestionKind,
  SuggestionToken,
} from './expressionSuggestions.js';
export { childLabel, collectionRowsFor } from './collectionGrid.js';
export type { CollectionRow } from './collectionGrid.js';
export {
  addChildTo,
  childrenIn,
  moveChildIn,
  removeChildFrom,
  setFastEntryIn,
  withChildren,
} from './collectionEdits.js';
export { fastEntryItems, fastEntryText } from './fastEntry.js';
export {
  GENERAL_CATEGORY,
  LOGIC_CATEGORY,
  orderPropertyCategories,
  PROPERTY_CATEGORIES,
  PROPERTY_CATEGORY_ORDER,
} from './propertyCategories.js';
export { canPlace, applyPlacement, countInList, dropSlotsFor, dropSlotsOn } from './placement.js';
export type { CountableSurface, DropSlot, PlacementSource } from './placement.js';
export { addPage, pageAfterRemoving, removePage } from './pageEdits.js';
export {
  CONDITION_OPERATORS,
  conditionOf,
  isUnaryOperator,
  printCondition,
  valueNodeOf,
} from './conditionTerms.js';
export type {
  Condition,
  ConditionJoin,
  ConditionOperator,
  ConditionTerm,
} from './conditionTerms.js';
export { JsonEditorSession } from './JsonEditorSession.js';
export { LOGIC_TEMPLATES, LogicSession } from './LogicSession.js';
export type { LogicRuleTemplate } from './LogicSession.js';
export { collectLogicRules } from './logicRules.js';
export type { LogicActionKind, LogicRule, LogicSite } from './logicRules.js';
export type { JsonEditorProblem, JsonEditorSessionOptions } from './JsonEditorSession.js';
export { locationOf, syntaxErrorOffset } from './jsonLocation.js';
export type { JsonLocation } from './jsonLocation.js';
export { PreviewSession } from './PreviewSession.js';
export { SaveController, sameDefinition } from './SaveController.js';
export type { SaveState, SurveySaver } from './SaveController.js';
export { ThemeEditorSession } from './ThemeEditorSession.js';
export type { ThemeEditorSessionOptions, ThemeProblem } from './ThemeEditorSession.js';
export { BUILT_IN_THEME_FIELDS, themeRowsFor, valueAt, withValueAt } from './themeFields.js';
export type { ThemeDocument, ThemeField, ThemeFieldKind, ThemeRow } from './themeFields.js';
export { TranslationSession } from './TranslationSession.js';
export type {
  MachineTranslator,
  TranslationRequest,
  TranslationRunResult,
  TranslationSessionOptions,
} from './TranslationSession.js';
export { collectTranslations, DEFAULT_LOCALE, localesUsed } from './translations.js';
export type { TranslationEntry } from './translations.js';
export { fromCsv, toCsv, translationCells, translationRows } from './translationSheet.js';
export type { TranslationCell } from './translationSheet.js';
export type { PreviewData, PreviewSessionOptions } from './PreviewSession.js';
export {
  DEFAULT_PREVIEW_DEVICE,
  PREVIEW_DEVICES,
  previewDevice,
  previewViewport,
} from './previewDevices.js';
export type { PreviewDevice, PreviewOrientation, PreviewViewport } from './previewDevices.js';
export { UndoHistory } from './UndoHistory.js';
export type { HistorySnapshot } from './UndoHistory.js';
export type { DropList, IsContainerType } from './definitionTree.js';
export { containersWithin, sameList, slotsOnPage } from './definitionTree.js';
export { Toolbox } from './Toolbox.js';
export type { ToolboxCategory, ToolboxOptions } from './Toolbox.js';
export { fallbackTitle, OTHER_CATEGORY } from './ToolboxItem.js';
export type { ToolboxItem, ToolboxItemDefinition } from './ToolboxItem.js';
export { BUILT_IN_TOOLBOX, CATEGORY_ORDER } from './builtInToolbox.js';
export type { BuiltInEntry } from './builtInToolbox.js';
