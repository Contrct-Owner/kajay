import { PanelDynamicQuestion } from '../model/PanelDynamicQuestion.js';
import type { MetadataRegistry } from './MetadataRegistry.js';
import { PANEL_TYPE_DEFINITIONS } from './panelTypeDefinitions.js';

/** Registers the repeating panel. Runs after the question and panel types it repeats. */
export function registerPanelTypes(registry: MetadataRegistry): void {
  registry.addClass({
    ...PANEL_TYPE_DEFINITIONS.panelDynamic,
    create: () => new PanelDynamicQuestion(),
  });
}
