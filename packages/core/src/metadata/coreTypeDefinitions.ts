import type { ClassMetadataDefinition } from './ClassDescriptor.js';
import { VISIBLE_IF } from './commonProperties.js';

interface CoreTypeDefinitions {
  readonly survey: ClassMetadataDefinition;
  readonly calculatedValue: ClassMetadataDefinition;
  readonly page: ClassMetadataDefinition;
}

/** Authoritative metadata for the survey root, calculated values, and pages. */
export const CORE_TYPE_DEFINITIONS: CoreTypeDefinitions = {
  survey: {
    name: 'survey',
    properties: [
      { name: 'title', type: 'string', description: 'Survey title shown above the first page.' },
      { name: 'description', type: 'string' },
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
    childCollections: [{ property: 'elements', elementBaseType: 'question' }],
  },
};
