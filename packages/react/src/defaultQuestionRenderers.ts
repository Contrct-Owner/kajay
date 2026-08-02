import { CollapsedSelectRenderer } from './CollapsedSelectRenderer.js';
import { CommentQuestionRenderer } from './CommentQuestionRenderer.js';
import { QuestionRendererRegistry } from './QuestionRendererRegistry.js';
import { SelectQuestionRenderer } from './SelectQuestionRenderer.js';
import { TextQuestionRenderer } from './TextQuestionRenderer.js';

function createDefaultRenderers(): QuestionRendererRegistry {
  const registry = new QuestionRendererRegistry();
  registry.register('text', TextQuestionRenderer);
  registry.register('comment', CommentQuestionRenderer);
  registry.register('radiogroup', SelectQuestionRenderer);
  registry.register('checkbox', SelectQuestionRenderer);
  registry.register('dropdown', CollapsedSelectRenderer);
  registry.register('tagbox', CollapsedSelectRenderer);
  return registry;
}

/**
 * Renderers for the built-in question types.
 *
 * Populated inside this module rather than by a side-effect import, so
 * `sideEffects: false` stays honest — see the same reasoning in core's globalRegistry.
 */
export const defaultQuestionRenderers: QuestionRendererRegistry = createDefaultRenderers();
