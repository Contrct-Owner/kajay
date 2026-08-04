import type { DesignSurfaceOptions } from './DesignSurfaceOptions.js';
import type { JsonEditorSessionOptions } from './JsonEditorSession.js';
import type { PreviewSessionOptions } from './PreviewSession.js';
import type { ThemeEditorSessionOptions } from './ThemeEditorSession.js';
import type { TranslationSessionOptions } from './TranslationSession.js';

/** Preview configuration whose registry is owned by the workspace. */
export type CreatorWorkspacePreviewOptions = Omit<PreviewSessionOptions, 'registry'>;

/** JSON-editor configuration whose registry is owned by the workspace. */
export type CreatorWorkspaceJsonOptions = Omit<JsonEditorSessionOptions, 'registry'>;

/** Translation configuration whose registry is owned by the workspace. */
export type CreatorWorkspaceTranslationOptions = Omit<
  TranslationSessionOptions,
  'registry'
>;

/**
 * Everything fixed for one Creator workspace lifetime.
 *
 * A new definition can still be opened through the design surface. Changing the registry,
 * deployment restrictions, or session seams instead creates a different workspace.
 */
export interface CreatorWorkspaceOptions extends DesignSurfaceOptions {
  readonly preview?: CreatorWorkspacePreviewOptions | undefined;
  readonly json?: CreatorWorkspaceJsonOptions | undefined;
  readonly translations?: CreatorWorkspaceTranslationOptions | undefined;
  readonly themeEditor?: ThemeEditorSessionOptions | undefined;
}
