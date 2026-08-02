import { QuestionRendererRegistry } from './QuestionRendererRegistry.js';
import { TextQuestionRenderer } from './TextQuestionRenderer.js';

function createDefaultRenderers(): QuestionRendererRegistry {
  const registry = new QuestionRendererRegistry();
  registry.register('text', TextQuestionRenderer);
  return registry;
}

/**
 * Renderers for the built-in question types.
 *
 * Populated inside this module rather than by a side-effect import, so
 * `sideEffects: false` stays honest — see the same reasoning in core's globalRegistry.
 */
export const defaultQuestionRenderers: QuestionRendererRegistry = createDefaultRenderers();
