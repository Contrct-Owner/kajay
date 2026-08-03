import { BooleanQuestionRenderer } from './BooleanQuestionRenderer.js';
import { CollapsedSelectRenderer } from './CollapsedSelectRenderer.js';
import { CommentQuestionRenderer } from './CommentQuestionRenderer.js';
import { ExpressionQuestionRenderer } from './ExpressionQuestionRenderer.js';
import { HtmlElementRenderer } from './HtmlElementRenderer.js';
import { ImageElementRenderer } from './ImageElementRenderer.js';
import { ImagePickerRenderer } from './ImagePickerRenderer.js';
import { MultipleTextQuestionRenderer } from './MultipleTextQuestionRenderer.js';
import { PageElementRendererRegistry } from './PageElementRendererRegistry.js';
import { PanelRenderer } from './PanelRenderer.js';
import { RankingQuestionRenderer } from './RankingQuestionRenderer.js';
import { RatingQuestionRenderer } from './RatingQuestionRenderer.js';
import { SelectQuestionRenderer } from './SelectQuestionRenderer.js';
import { TextQuestionRenderer } from './TextQuestionRenderer.js';

function createDefaultRenderers(): PageElementRendererRegistry {
  const registry = new PageElementRendererRegistry();
  registry.registerQuestion('text', TextQuestionRenderer);
  registry.registerQuestion('comment', CommentQuestionRenderer);
  registry.registerQuestion('boolean', BooleanQuestionRenderer);
  registry.registerQuestion('rating', RatingQuestionRenderer);
  registry.registerQuestion('expression', ExpressionQuestionRenderer);
  registry.registerQuestion('multipletext', MultipleTextQuestionRenderer);
  registry.registerQuestion('radiogroup', SelectQuestionRenderer);
  registry.registerQuestion('checkbox', SelectQuestionRenderer);
  registry.registerQuestion('dropdown', CollapsedSelectRenderer);
  registry.registerQuestion('tagbox', CollapsedSelectRenderer);
  registry.registerQuestion('imagepicker', ImagePickerRenderer);
  registry.registerQuestion('ranking', RankingQuestionRenderer);
  registry.register('panel', PanelRenderer);
  registry.register('html', HtmlElementRenderer);
  registry.register('image', ImageElementRenderer);
  return registry;
}

/** Built-in question, panel, and display-element renderers. */
export const defaultPageElementRenderers: PageElementRendererRegistry = createDefaultRenderers();
