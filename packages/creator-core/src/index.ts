// The entire public surface of @kajay/creator-core. Anything not re-exported here is
// private, and there are no subpath entries (ADR-0010) — this file *is* the package.

export { DesignSurface } from './DesignSurface.js';
export type { DesignSurfaceOptions, EditOptions } from './DesignSurfaceOptions.js';
export { CreatorWorkspace } from './CreatorWorkspace.js';
export type {
  CreatorWorkspaceJsonOptions,
  CreatorWorkspaceOptions,
  CreatorWorkspacePreviewOptions,
  CreatorWorkspaceTranslationOptions,
} from './CreatorWorkspaceOptions.js';
export type { CreatorConfiguration } from './CreatorConfiguration.js';
export { CreatorStringDictionary } from './CreatorStringDictionary.js';
export type { CreatorStringKey, CreatorStrings } from './creatorStrings.js';
export { refuse, refusalMessageKey } from './EditRefusal.js';
export type { EditRefusal, EditRefusalKind } from './EditRefusal.js';
export { nameRefusal } from './nameRefusal.js';
export type { DesignSelection } from './DesignSelection.js';
export {
  localesOf,
  localizedTextIn,
  parseEditorText,
} from './propertyGrid.js';
export type {
  PropertyCommit,
  PropertyEditorKind,
  PropertyGridCategory,
  PropertyRow,
} from './propertyGrid.js';
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
export { childLabel } from './collectionGrid.js';
export type { CollectionRow } from './collectionGrid.js';
export { fastEntryText } from './fastEntry.js';
export type { DropSlot, PlacementSource } from './placement.js';
export type {
  PlacementCommand,
  PlacementDirection,
  PlacementNarration,
  PlacementNarrationKind,
  PlacementOutcome,
  PlacementSession,
  PlacementSnapshot,
} from './PlacementSession.js';
export {
  CONDITION_OPERATORS,
  isUnaryOperator,
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
export type { LogicActionKind, LogicRule, LogicSite } from './logicRules.js';
export type { JsonEditorProblem, JsonEditorSessionOptions } from './JsonEditorSession.js';
export type { JsonLocation } from './jsonLocation.js';
export { PreviewSession } from './PreviewSession.js';
export { SaveController, sameDefinition } from './SaveController.js';
export type { SaveState, SurveySaver } from './SaveController.js';
export { ThemeEditorSession } from './ThemeEditorSession.js';
export type { ThemeEditorSessionOptions, ThemeProblem } from './ThemeEditorSession.js';
export type { ThemeDocument, ThemeField, ThemeFieldKind, ThemeRow } from './themeFields.js';
export { TranslationSession } from './TranslationSession.js';
export type {
  MachineTranslator,
  TranslationRequest,
  TranslationRunResult,
  TranslationSessionOptions,
} from './TranslationSession.js';
export { DEFAULT_LOCALE } from './translations.js';
export type { TranslationEntry } from './translations.js';
export type { PreviewData, PreviewSessionOptions } from './PreviewSession.js';
export {
  PREVIEW_DEVICES,
  previewDevice,
} from './previewDevices.js';
export type { PreviewDevice, PreviewOrientation, PreviewViewport } from './previewDevices.js';
export type { DropList } from './definitionTree.js';
export { Toolbox } from './Toolbox.js';
export type { ToolboxCategory, ToolboxOptions } from './Toolbox.js';
export type { ToolboxItem, ToolboxItemDefinition } from './ToolboxItem.js';
