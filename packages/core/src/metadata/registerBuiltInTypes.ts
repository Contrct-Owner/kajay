import { CalculatedValue } from '../model/CalculatedValue.js';
import { Page } from '../model/Page.js';
import { Survey } from '../model/Survey.js';
import { TextQuestion } from '../model/TextQuestion.js';
import { Trigger } from '../model/Trigger.js';
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
    childCollections: [
      { property: 'pages', elementBaseType: 'page' },
      { property: 'calculatedValues', elementBaseType: 'calculatedvalue' },
      { property: 'triggers', elementBaseType: 'trigger' },
    ],
    create: () => new Survey(),
  });
}

/**
 * Triggers: an abstract base plus one concrete class per kind.
 *
 * Splitting them by class rather than giving one class every property is what lets the
 * contract say precisely which properties each kind takes, and what stops
 * `{"type": "complete", "gotoName": "..."}` from looking well-formed.
 */
function registerTriggerBase(registry: MetadataRegistry): void {
  registry.addClass({
    name: 'trigger',
    isAbstract: true,
    properties: [
      {
        name: 'expression',
        type: 'string',
        isRequired: true,
        description: 'The trigger acts when this becomes true, not while it stays true.',
      },
    ],
  });
}

/** Kinds that write an answer. */
function registerValueTriggers(registry: MetadataRegistry): void {
  registry.addClass({
    name: 'setvalue',
    parent: 'trigger',
    properties: [
      { name: 'setToName', type: 'string', isRequired: true },
      { name: 'setValue', type: 'value', description: 'Literal written to setToName.' },
    ],
    create: () => new Trigger('setvalue'),
  });

  registry.addClass({
    name: 'copyvalue',
    parent: 'trigger',
    properties: [
      { name: 'setToName', type: 'string', isRequired: true },
      { name: 'fromName', type: 'string', isRequired: true },
    ],
    create: () => new Trigger('copyvalue'),
  });

  registry.addClass({
    name: 'runexpression',
    parent: 'trigger',
    properties: [
      { name: 'setToName', type: 'string' },
      { name: 'runExpression', type: 'string', isRequired: true },
    ],
    create: () => new Trigger('runexpression'),
  });
}

/** Kinds that act on the survey rather than on an answer. */
function registerFlowTriggers(registry: MetadataRegistry): void {
  registry.addClass({ name: 'complete', parent: 'trigger', create: () => new Trigger('complete') });

  registry.addClass({
    name: 'skip',
    parent: 'trigger',
    properties: [
      {
        name: 'gotoName',
        type: 'string',
        isRequired: true,
        description: 'Page name, or a question name whose page is navigated to.',
      },
    ],
    create: () => new Trigger('skip'),
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
      {
        name: 'enableIf',
        type: 'string',
        description: 'Expression; the question is editable only while it evaluates truthy.',
      },
      {
        name: 'requiredIf',
        type: 'string',
        description: 'Expression; when present it overrides isRequired.',
      },
      {
        name: 'defaultValueExpression',
        type: 'string',
        description: 'Expression supplying a value while the question is unanswered.',
      },
      {
        name: 'setValueIf',
        type: 'string',
        description: 'Expression; while truthy, setValueExpression drives the answer.',
      },
      { name: 'setValueExpression', type: 'string' },
      {
        name: 'resetValueIf',
        type: 'string',
        description: 'Expression; while truthy the answer is cleared. Wins over the others.',
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
  registerCalculatedValueType(registry);
  registerTriggerBase(registry);
  registerValueTriggers(registry);
  registerFlowTriggers(registry);
  registerPageType(registry);
  registerQuestionBase(registry);
  registerQuestionTypes(registry);
}
