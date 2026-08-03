// The entire public surface of @kajay/react.

export type { HtmlSanitizer } from './HtmlSanitizerContext.js';
export { defaultPageElementRenderers } from './defaultPageElementRenderers.js';
export { PageElementRendererRegistry } from './PageElementRendererRegistry.js';
// Exported for the Creator's design surface (K3): it draws elements one at a time so it
// can wrap each in an adorner, and re-implementing the slot there would put I5's layout
// decisions in a second place to drift from this one.
export { PageElementSlot } from './PageElementSlot.js';
export {
  PageElementDecoratorProvider,
  usePageElementDecorator,
} from './PageElementDecoratorContext.js';
export type {
  PageElementDecorator,
  PageElementDecoratorProviderProps,
} from './PageElementDecoratorContext.js';
export type { PageElementSlotProps } from './PageElementSlot.js';
export type {
  PageElementRenderer,
  PageElementRendererProps,
} from './PageElementRendererRegistry.js';
export type { QuestionRendererProps } from './QuestionRendererProps.js';
export type { QuestionRenderer } from './QuestionRendererRegistry.js';
export type {
  DraggedRow,
  GrabbedRow,
  ReorderContext,
  ReorderOptions,
  ReorderState,
} from './ReorderContext.js';
export { reorderAnnouncement } from './reorderAnnouncement.js';
export type { ReorderEventKind } from './reorderAnnouncement.js';
export { Survey } from './Survey.js';
export type { SurveyCss } from './SurveyCssContext.js';
export type { TextRenderer } from './TextRendererContext.js';
export type { SurveyProps } from './Survey.js';
export { useReorder } from './useReorder.js';
export type { Reorder, ReorderItemProps } from './useReorder.js';
export {
  useQuestionValue,
  useSurveyCompleted,
  useSurveyCurrentPageNo,
  useSurveyLogicState,
  useSurveyStatus,
  useSurveyValidating,
  useSurveyValue,
} from './useSurveyState.js';
