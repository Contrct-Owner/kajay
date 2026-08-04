import { DesignSurface } from './DesignSurface.js';
import { JsonEditorSession } from './JsonEditorSession.js';
import { LogicSession } from './LogicSession.js';
import { PreviewSession } from './PreviewSession.js';
import { ThemeEditorSession } from './ThemeEditorSession.js';
import { Toolbox } from './Toolbox.js';
import { TranslationSession } from './TranslationSession.js';
import type { CreatorWorkspaceOptions } from './CreatorWorkspaceOptions.js';

/**
 * One coherent headless Creator and the lifetime of every model that follows it.
 *
 * The surface is constructed first and resolves the registry used by the document. Every
 * registry-aware model then receives that exact registry, so a custom type cannot appear on
 * the canvas and disappear from the toolbox, preview, JSON diagnostics, or translations.
 *
 * Views keep taking the narrow model they draw. This aggregate exists for assembly and
 * lifetime ownership, not as a monolithic prop passed through the UI.
 */
export class CreatorWorkspace {
  readonly surface: DesignSurface;
  readonly toolbox: Toolbox;
  readonly preview: PreviewSession;
  readonly json: JsonEditorSession;
  readonly translations: TranslationSession;
  readonly logic: LogicSession;
  readonly themeEditor: ThemeEditorSession;
  #isDisposed = false;

  constructor(options: CreatorWorkspaceOptions) {
    this.surface = new DesignSurface(options);
    const registry = this.surface.registry;
    this.toolbox = new Toolbox({ registry, configuration: options.configuration });
    // Registry is written last deliberately. JavaScript callers may hand these constructors
    // an object with extra fields despite the public types; no such field may split a
    // workspace across two metadata universes.
    this.preview = new PreviewSession(this.surface, { ...options.preview, registry });
    this.json = new JsonEditorSession(this.surface, { ...options.json, registry });
    this.translations = new TranslationSession(this.surface, {
      ...options.translations,
      registry,
    });
    this.logic = new LogicSession(this.surface);
    this.themeEditor = new ThemeEditorSession(options.themeEditor);
  }

  /**
   * Stops every model that follows the surface. Terminal and safe to call more than once.
   *
   * The models remain readable as their final snapshots, but no session follows a later
   * surface edit and the workspace cannot be reactivated.
   */
  dispose(): void {
    if (this.#isDisposed) {
      return;
    }
    this.#isDisposed = true;
    this.preview.dispose();
    this.json.dispose();
    this.translations.dispose();
    this.logic.dispose();
  }
}
