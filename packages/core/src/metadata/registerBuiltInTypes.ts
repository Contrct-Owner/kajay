import { Page } from '../model/Page.js';
import { Survey } from '../model/Survey.js';
import { TextQuestion } from '../model/TextQuestion.js';
import type { MetadataRegistry } from './MetadataRegistry.js';

/**
 * Registers the Phase 0 type set.
 *
 * Property declaration order here *is* the canonical key order of serialized output
 * (ADR-0002), so reordering this list is a contract change and will show up as a diff
 * in `contracts/survey-schema.json`.
 */
export function registerBuiltInTypes(registry: MetadataRegistry): void {
  registry.addClass({
    name: 'survey',
    properties: [
      { name: 'title', type: 'string', description: 'Survey title shown above the first page.' },
      { name: 'description', type: 'string' },
    ],
    childCollection: { property: 'pages', elementBaseType: 'page' },
    create: () => new Survey(),
  });

  registry.addClass({
    name: 'page',
    properties: [
      { name: 'name', type: 'string', isRequired: true, description: 'Unique page identifier.' },
      { name: 'title', type: 'string' },
    ],
    childCollection: { property: 'elements', elementBaseType: 'question' },
    create: () => new Page(),
  });

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
    ],
  });

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
