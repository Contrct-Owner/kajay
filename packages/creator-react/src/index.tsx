// The entire public surface of @kajay/creator-react. Anything not re-exported here is
// private, and there are no subpath entries (ADR-0010) — this file *is* the package.
//
// These are the *pieces* (ADR-0021). The default assembly that arranges them lands with
// the design surface, and will be built from nothing but what is exported here.

export { DesignSurfacePanel } from './DesignSurfacePanel.js';
export type { DesignSurfacePanelProps } from './DesignSurfacePanel.js';
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
  CreatorComponents,
  CreatorComponentsProviderProps,
  CreatorInputProps,
  ResolvedCreatorComponents,
} from './CreatorComponents.js';
