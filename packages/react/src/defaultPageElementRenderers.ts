import { BooleanQuestionRenderer } from './BooleanQuestionRenderer.js';
import { CollapsedSelectRenderer } from './CollapsedSelectRenderer.js';
import { CommentQuestionRenderer } from './CommentQuestionRenderer.js';
import { ExpressionQuestionRenderer } from './ExpressionQuestionRenderer.js';
import { FileQuestionRenderer } from './FileQuestionRenderer.js';
import { HtmlElementRenderer } from './HtmlElementRenderer.js';
import { ImageElementRenderer } from './ImageElementRenderer.js';
import { ImagePickerRenderer } from './ImagePickerRenderer.js';
import { MatrixCellsRenderer } from './MatrixCellsRenderer.js';
import { MatrixDynamicRenderer } from './MatrixDynamicRenderer.js';
import { MatrixQuestionRenderer } from './MatrixQuestionRenderer.js';
import { FillInTheBlankQuestionRenderer } from './FillInTheBlankQuestionRenderer.js';
import { registerInlineQuestionRenderers } from './inlineQuestionRenderers.js';
import { MultipleTextQuestionRenderer } from './MultipleTextQuestionRenderer.js';
import { PageElementRendererRegistry } from './PageElementRendererRegistry.js';
import type { ReadonlyPageElementRendererRegistry } from './PageElementRendererRegistry.js';
import { PanelRenderer } from './PanelRenderer.js';
import { PanelDynamicRenderer } from './PanelDynamicRenderer.js';
import { RankingQuestionRenderer } from './RankingQuestionRenderer.js';
import { RatingQuestionRenderer } from './RatingQuestionRenderer.js';
import { SelectQuestionRenderer } from './SelectQuestionRenderer.js';
import { SignatureQuestionRenderer } from './SignatureQuestionRenderer.js';
import { TextQuestionRenderer } from './TextQuestionRenderer.js';

function createDefaultRenderers(): ReadonlyPageElementRendererRegistry {
  const registry = new PageElementRendererRegistry();
  registry.registerQuestion('text', TextQuestionRenderer);
  registry.registerQuestion('comment', CommentQuestionRenderer);
  registry.registerQuestion('boolean', BooleanQuestionRenderer);
  registry.registerQuestion('rating', RatingQuestionRenderer);
  registry.registerQuestion('expression', ExpressionQuestionRenderer);
  // Registered as a page element rather than through `registerQuestion`, because it is the
  // one renderer that draws *other* questions and so needs the resolver.
  registry.register('fillintheblank', FillInTheBlankQuestionRenderer);
  registerInlineQuestionRenderers(registry);
  registry.registerQuestion('multipletext', MultipleTextQuestionRenderer);
  registry.registerQuestion('radiogroup', SelectQuestionRenderer);
  registry.registerQuestion('checkbox', SelectQuestionRenderer);
  registry.registerQuestion('dropdown', CollapsedSelectRenderer);
  registry.registerQuestion('tagbox', CollapsedSelectRenderer);
  registry.registerQuestion('imagepicker', ImagePickerRenderer);
  registry.registerQuestion('ranking', RankingQuestionRenderer);
  registry.registerQuestion('matrix', MatrixQuestionRenderer);
  registry.registerQuestion('matrixcells', MatrixCellsRenderer);
  registry.registerQuestion('matrixdynamic', MatrixDynamicRenderer);
  registry.registerQuestion('paneldynamic', PanelDynamicRenderer);
  registry.registerQuestion('file', FileQuestionRenderer);
  registry.registerQuestion('signaturepad', SignatureQuestionRenderer);
  registry.register('panel', PanelRenderer);
  registry.register('html', HtmlElementRenderer);
  registry.register('image', ImageElementRenderer);
  return registry.freeze();
}

/** Built-in question, panel, and display-element renderers. */
export const defaultPageElementRenderers: ReadonlyPageElementRendererRegistry =
  createDefaultRenderers();
