// The entire public surface of @kajay/creator-react. Anything not re-exported here is
// private, and there are no subpath entries (ADR-0010) — this file *is* the package.
//
// These are the *pieces* (ADR-0021). The default assembly that arranges them lands with
// the design surface, and will be built from nothing but what is exported here.

export { DesignSurfacePanel } from './DesignSurfacePanel.js';
export type { DesignSurfacePanelProps } from './DesignSurfacePanel.js';
export { HistoryPanel } from './HistoryPanel.js';
export type { HistoryPanelProps } from './HistoryPanel.js';
export { historyShortcut, isTextEntry } from './historyShortcut.js';
export type { HistoryIntent, HistoryKey } from './historyShortcut.js';
export { PageNavigatorPanel } from './PageNavigatorPanel.js';
export type { PageNavigatorPanelProps } from './PageNavigatorPanel.js';
export { PropertyGridPanel } from './PropertyGridPanel.js';
export type { PropertyGridPanelProps } from './PropertyGridPanel.js';
export { PropertyEditorProvider, usePropertyEditor } from './PropertyEditors.js';
export type {
  PropertyEditorProps,
  PropertyEditorProviderProps,
  PropertyEditorResolver,
} from './PropertyEditors.js';
export { CollectionEditor } from './CollectionEditor.js';
export type { CollectionEditorProps } from './CollectionEditor.js';
export { PropertySection } from './PropertyFields.js';
export type { PropertySectionProps } from './PropertyFields.js';
export { ExpressionField } from './ExpressionField.js';
export type { ExpressionFieldProps } from './ExpressionField.js';
export { TranslationsField } from './TranslationsField.js';
export type { TranslationsFieldProps } from './TranslationsField.js';
export { ToolboxPanel } from './ToolboxPanel.js';
export { useDesignerPlacement } from './useDesignerPlacement.js';
export type {
  DesignerPlacement,
  PlacementDragProps,
  PlacementHandleProps,
  PlacementItemProps,
} from './useDesignerPlacement.js';
export type { ToolboxPanelProps } from './ToolboxPanel.js';
export { CreatorComponentsProvider, useCreatorComponents } from './CreatorComponents.js';
export type {
  CreatorButtonProps,
  CreatorCheckboxProps,
  CreatorComponents,
  CreatorComponentsProviderProps,
  CreatorInputProps,
  CreatorSelectOption,
  CreatorSelectProps,
  CreatorTextareaProps,
  ResolvedCreatorComponents,
} from './CreatorComponents.js';
export { ElementActions } from './ElementActions.js';
export type { ElementActionsProps } from './ElementActions.js';
