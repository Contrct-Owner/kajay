// The entire public surface of @kajay/react.

export type { HtmlSanitizer } from './HtmlSanitizerContext.js';
export { defaultPageElementRenderers } from './defaultPageElementRenderers.js';
export { PageElementRendererRegistry } from './PageElementRendererRegistry.js';
// Exported for the Creator's design surface (K3): it draws elements one at a time so it
// can wrap each in an adorner, and re-implementing the slot there would put I5's layout
// decisions in a second place to drift from this one.
// E7's read-only action vocabulary, public because §L3's property grid says the same thing
// about an action a designer may not take. Input and radio helpers remain renderer internals.
export { readOnlyAction } from './readOnly.js';
export { PageElementSlot } from './PageElementSlot.js';
export { PageElementDecoratorProvider } from './PageElementDecoratorContext.js';
export type {
  PageElementDecorator,
  PageElementDecoratorProviderProps,
} from './PageElementDecoratorContext.js';
export type { PageElementSlotProps } from './PageElementSlot.js';
export type {
  PageElementRenderer,
  PageElementRendererProps,
  PageElementRendererResolver,
  ReadonlyPageElementRendererRegistry,
} from './PageElementRendererRegistry.js';
export type { QuestionRendererProps } from './QuestionRendererProps.js';
// **What a custom renderer needs, and did not have** — checklist P9.
//
// ADR-0019 makes replacing a question type a supported seam, and every one of our own
// renderers builds its ids and draws its title and errors with these five. A host's could
// not: it had `QuestionRendererProps` and had to invent the rest. Inventing ids is not a
// style choice — after P7 they must carry the survey's scope or two surveys on a page
// collide again, which is the defect P7 had just removed everywhere except here.
export { questionErrorId, questionId } from './questionId.js';
export { useIdScope } from './idScope.js';
export { QuestionErrors } from './QuestionErrors.js';
export type { QuestionErrorsProps } from './QuestionErrors.js';
export { QuestionTitleContent } from './QuestionTitleContent.js';
export type { QuestionTitleContentProps } from './QuestionTitleContent.js';
// The renderer's own primitive seam — ADR-0022's second half, checklist P2. Separate from
// the Creator's map because `@kajay/react` cannot import `@kajay/creator-react` without
// inverting the dependency direction; a host who wants one object spreads theirs into both.
export { SurveyComponentsProvider, useSurveyComponents } from './SurveyComponents.js';
export type {
  ResolvedSurveyComponents,
  SurveyButtonProps,
  SurveyChoiceProps,
  SurveyComponents,
  SurveyComponentsProviderProps,
  SurveyInputProps,
  SurveyTextareaProps,
} from './SurveyComponents.js';
// Exported for the Creator's design surface (N5): a question that contains questions —
// a matrix cell, a repeating panel's instance — looks its children up in the registry it
// is being drawn through, and `<Survey>` is not the only thing that draws elements.
export { QuestionRenderersProvider, useQuestionRenderers } from './QuestionRenderersContext.js';
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
  useSurveyCurrentPageNo,
  useSurveyStatus,
  useSurveyValidating,
  useSurveyValue,
} from './useSurveyState.js';
