import { Page } from '../model/Page.js';
import { Survey } from '../model/Survey.js';
import { TextQuestion } from '../model/TextQuestion.js';
import type { MetadataRegistry } from './MetadataRegistry.js';

/**
 * Property declaration order *is* the canonical key order of serialized output
 * (ADR-0002), so reordering any of these lists is a contract change and will show up
 * as a diff in `contracts/survey-schema.json`.
 */

const VISIBLE_IF = {
  name: 'visibleIf',
  type: 'string',
} as const;

function registerSurveyType(registry: MetadataRegistry): void {
  registry.addClass({
    name: 'survey',
    properties: [
      { name: 'title', type: 'string', description: 'Survey title shown above the first page.' },
      { name: 'description', type: 'string' },
    ],
    childCollection: { property: 'pages', elementBaseType: 'page' },
    create: () => new Survey(),
  });
}

function registerPageType(registry: MetadataRegistry): void {
  registry.addClass({
    name: 'page',
    properties: [
      { name: 'name', type: 'string', isRequired: true, description: 'Unique page identifier.' },
      { name: 'title', type: 'string' },
      {
        ...VISIBLE_IF,
        description: 'Expression; the page is shown only while it evaluates truthy.',
      },
    ],
    childCollection: { property: 'elements', elementBaseType: 'question' },
    create: () => new Page(),
  });
}

/** Abstract base. Contributes inherited properties; cannot be instantiated. */
function registerQuestionBase(registry: MetadataRegistry): void {
  registry.addClass({
    name: 'question',
    isAbstract: true,
    properties: [
      {
        name: 'name',
        type: 'string',
        isRequired: true,
        description: 'Unique question identifier, and the key its answer is stored under.',
      },
      { name: 'title', type: 'string', description: 'Display title; falls back to name.' },
      { name: 'isRequired', type: 'boolean' },
      {
        ...VISIBLE_IF,
        description: 'Expression; the question is shown only while it evaluates truthy.',
      },
    ],
  });
}

function registerQuestionTypes(registry: MetadataRegistry): void {
  registry.addClass({
    name: 'text',
    parent: 'question',
    properties: [
      { name: 'inputType', type: 'string', defaultValue: 'text' },
      { name: 'placeholder', type: 'string' },
    ],
    create: () => new TextQuestion(),
  });
}

/** Registers the built-in type set. Parents must be registered before their children. */
export function registerBuiltInTypes(registry: MetadataRegistry): void {
  registerSurveyType(registry);
  registerPageType(registry);
  registerQuestionBase(registry);
  registerQuestionTypes(registry);
}
