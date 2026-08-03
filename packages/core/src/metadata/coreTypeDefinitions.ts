import type { ClassMetadataDefinition } from './ClassDescriptor.js';
import { VISIBLE_IF } from './commonProperties.js';

interface CoreTypeDefinitions {
  readonly survey: ClassMetadataDefinition;
  readonly calculatedValue: ClassMetadataDefinition;
  readonly htmlCondition: ClassMetadataDefinition;
  readonly pageElement: ClassMetadataDefinition;
  readonly page: ClassMetadataDefinition;
  readonly panel: ClassMetadataDefinition;
}

/** Authoritative metadata for the survey root, calculated values, pages and panels. */
export const CORE_TYPE_DEFINITIONS: CoreTypeDefinitions = {
  survey: {
    name: 'survey',
    properties: [
      { name: 'title', type: 'string', description: 'Survey title shown above the first page.' },
      { name: 'description', type: 'string' },
      {
        name: 'questionsOnPageMode',
        type: 'string',
        defaultValue: 'standard',
        description: 'standard, singlePage or questionPerPage.',
      },
      {
        name: 'validationEnabled',
        type: 'boolean',
        defaultValue: true,
        description: 'Set false to stop validation blocking navigation or completion.',
      },
      {
        name: 'checkErrorsMode',
        type: 'string',
        defaultValue: 'onNextPage',
        description: 'onNextPage, onValueChanged or onComplete.',
      },
      {
        name: 'questionErrorLocation',
        type: 'string',
        defaultValue: 'top',
        description: 'Whether a question draws its errors above its input or below it.',
      },
      {
        name: 'readOnly',
        type: 'boolean',
        description: 'The whole survey is for reading rather than answering.',
      },
      {
        name: 'goNextPageAutomatic',
        type: 'boolean',
        description: 'Turn the page once every question on it has a one-step answer.',
      },
      {
        name: 'autoFocusFirstQuestion',
        type: 'boolean',
        description: 'Give the first question on each page focus as the page arrives.',
      },
      {
        name: 'showProgressBar',
        type: 'string',
        defaultValue: 'off',
        description: 'off, top, bottom or both.',
      },
      {
        name: 'progressBarType',
        type: 'string',
        defaultValue: 'pages',
        description: 'pages, questions or requiredQuestions.',
      },
      {
        name: 'showTOC',
        type: 'boolean',
        description: 'Offer a list of pages the respondent can jump between.',
      },
      {
        name: 'showPreviewBeforeComplete',
        type: 'string',
        defaultValue: 'noPreview',
        description: 'noPreview, showAllQuestions or showAnsweredQuestions.',
      },
      {
        name: 'clearInvisibleValues',
        type: 'string',
        defaultValue: 'onComplete',
        description: 'none, onHidden or onComplete. What happens to an unreachable answer.',
      },
      {
        name: 'completedHtml',
        type: 'string',
        description: 'Markup shown once the survey is finished. {name} resolves to an answer.',
      },
      {
        name: 'loadingHtml',
        type: 'string',
        description: 'Markup shown while the host reports the survey as loading.',
      },
      {
        name: 'emptyHtml',
        type: 'string',
        description: 'Markup shown when no page is visible, so there is nothing to answer.',
      },
    ],
    childCollections: [
      { property: 'pages', elementBaseType: 'page' },
      { property: 'calculatedValues', elementBaseType: 'calculatedvalue' },
      { property: 'triggers', elementBaseType: 'trigger' },
      { property: 'completedHtmlOnCondition', elementBaseType: 'htmlcondition' },
    ],
  },
  htmlCondition: {
    name: 'htmlcondition',
    properties: [
      { name: 'expression', type: 'string', isRequired: true, isExpression: true },
      { name: 'html', type: 'string', isRequired: true },
    ],
  },
  calculatedValue: {
    name: 'calculatedvalue',
    properties: [
      {
        name: 'name',
        type: 'string',
        isRequired: true,
        description: 'The name this value is referenced by in expressions.',
      },
      { name: 'expression', type: 'string', isRequired: true, isExpression: true },
      {
        name: 'includeIntoResult',
        type: 'boolean',
        description: 'Whether the computed value joins the survey answers.',
      },
    ],
  },
  /**
   * Abstract base for anything a page can contain.
   *
   * Questions and panels share identity and conditional state; only a question holds an
   * answer. Declaring the shared half once is what lets `page.elements` accept both
   * without a special case per container.
   */
  pageElement: {
    name: 'pageelement',
    isAbstract: true,
    properties: [
      {
        name: 'name',
        type: 'string',
        isRequired: true,
        description: 'Unique element identifier. For a question, also its answer key.',
      },
      { name: 'title', type: 'string', description: 'Display title; falls back to name.' },
      {
        ...VISIBLE_IF,
        description: 'Expression; the element is shown only while it evaluates truthy.',
      },
      {
        name: 'enableIf',
        type: 'string',
        isExpression: true,
        description: 'Expression; the element is editable only while it evaluates truthy.',
      },
    ],
  },
  /**
   * Deliberately *not* a `pageelement`.
   *
   * A page contains page elements; it is not one. Parenting it here would put `page`
   * into `getConcreteSubclasses('pageelement')`, which is what `page.elements` admits —
   * making a page a legal child of a page. The four repeated declarations are the price
   * of that constraint, and cheaper than the constraint not existing.
   */
  page: {
    name: 'page',
    properties: [
      { name: 'name', type: 'string', isRequired: true, description: 'Unique page identifier.' },
      { name: 'title', type: 'string' },
      {
        ...VISIBLE_IF,
        description: 'Expression; the page is shown only while it evaluates truthy.',
      },
    ],
    childCollections: [{ property: 'elements', elementBaseType: 'pageelement' }],
  },
  panel: {
    name: 'panel',
    parent: 'pageelement',
    properties: [
      { name: 'description', type: 'string' },
      {
        name: 'state',
        type: 'string',
        defaultValue: 'default',
        description: 'default, expanded or collapsed. Collapsed panels start closed.',
      },
    ],
    childCollections: [{ property: 'elements', elementBaseType: 'pageelement' }],
  },
};
