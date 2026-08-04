// The entire public surface of @kajay/creator-core. Anything not re-exported here is
// private, and there are no subpath entries (ADR-0010) — this file *is* the package.

export { DesignSurface } from './DesignSurface.js';
export type { DesignSurfaceOptions, EditOptions } from './DesignSurface.js';
export { addPageTo, placeOn, removePageFrom } from './designerEdits.js';
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
export { canPlace, applyPlacement, dropSlotsFor, dropSlotsOn } from './placement.js';
export type { DropSlot, PlacementSource } from './placement.js';
export { addPage, pageAfterRemoving, removePage } from './pageEdits.js';
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
