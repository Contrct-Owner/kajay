import { BooleanQuestionRenderer } from './BooleanQuestionRenderer.js';
import { CollapsedSelectRenderer } from './CollapsedSelectRenderer.js';
import { CommentQuestionRenderer } from './CommentQuestionRenderer.js';
import { ExpressionQuestionRenderer } from './ExpressionQuestionRenderer.js';
import { MultipleTextQuestionRenderer } from './MultipleTextQuestionRenderer.js';
import { QuestionRendererRegistry } from './QuestionRendererRegistry.js';
import { RatingQuestionRenderer } from './RatingQuestionRenderer.js';
import { SelectQuestionRenderer } from './SelectQuestionRenderer.js';
import { TextQuestionRenderer } from './TextQuestionRenderer.js';

function createDefaultRenderers(): QuestionRendererRegistry {
  const registry = new QuestionRendererRegistry();
  registry.register('text', TextQuestionRenderer);
  registry.register('comment', CommentQuestionRenderer);
  registry.register('boolean', BooleanQuestionRenderer);
  registry.register('rating', RatingQuestionRenderer);
  registry.register('expression', ExpressionQuestionRenderer);
  registry.register('multipletext', MultipleTextQuestionRenderer);
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
