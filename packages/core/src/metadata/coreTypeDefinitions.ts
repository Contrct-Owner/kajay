import type { ClassMetadataDefinition } from './ClassDescriptor.js';
import { VISIBLE_IF } from './commonProperties.js';

interface CoreTypeDefinitions {
  readonly survey: ClassMetadataDefinition;
  readonly calculatedValue: ClassMetadataDefinition;
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
    ],
    childCollections: [
      { property: 'pages', elementBaseType: 'page' },
      { property: 'calculatedValues', elementBaseType: 'calculatedvalue' },
      { property: 'triggers', elementBaseType: 'trigger' },
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
      { name: 'expression', type: 'string', isRequired: true },
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
