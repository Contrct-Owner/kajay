import { CalculatedValue } from '../model/CalculatedValue.js';
import { Page } from '../model/Page.js';
import { Survey } from '../model/Survey.js';
import { VISIBLE_IF } from './commonProperties.js';
import type { MetadataRegistry } from './MetadataRegistry.js';

/**
 * Property declaration order *is* the canonical key order of serialized output
 * (ADR-0002), so reordering any list here is a contract change and shows up as a diff
 * in `contracts/survey-schema.json`.
 */

function registerSurveyType(registry: MetadataRegistry): void {
  registry.addClass({
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
    create: () => new Survey(),
  });
}

function registerCalculatedValueType(registry: MetadataRegistry): void {
  registry.addClass({
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
    create: () => new CalculatedValue(),
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
    childCollections: [{ property: 'elements', elementBaseType: 'question' }],
    create: () => new Page(),
  });
}

/** Abstract base. Contributes inherited properties; cannot be instantiated. */
/** The survey root, its calculated values, and pages. */
export function registerCoreTypes(registry: MetadataRegistry): void {
  registerSurveyType(registry);
  registerCalculatedValueType(registry);
  registerPageType(registry);
}
