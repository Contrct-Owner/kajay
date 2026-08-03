// The entire public surface of @kajay/creator-core. Anything not re-exported here is
// private, and there are no subpath entries (ADR-0010) — this file *is* the package.

export { DesignSurface } from './DesignSurface.js';
export type { DesignSurfaceOptions } from './DesignSurface.js';
export { canPlace, applyPlacement, dropSlotsFor } from './placement.js';
export type { DropSlot, PlacementSource } from './placement.js';
export { addPage, pageAfterRemoving, removePage } from './pageEdits.js';
export type { DropList } from './definitionTree.js';
export { Toolbox } from './Toolbox.js';
export type { ToolboxCategory, ToolboxOptions } from './Toolbox.js';
export { fallbackTitle, OTHER_CATEGORY } from './ToolboxItem.js';
export type { ToolboxItem, ToolboxItemDefinition } from './ToolboxItem.js';
export { BUILT_IN_TOOLBOX, CATEGORY_ORDER } from './builtInToolbox.js';
export type { BuiltInEntry } from './builtInToolbox.js';
