import { TextQuestion } from '../model/TextQuestion.js';
import { VISIBLE_IF } from './commonProperties.js';
import type { MetadataRegistry } from './MetadataRegistry.js';

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

function registerPlainQuestionTypes(registry: MetadataRegistry): void {
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

/** The question base and the types that are not select questions. */
export function registerQuestionTypes(registry: MetadataRegistry): void {
  registerQuestionBase(registry);
  registerPlainQuestionTypes(registry);
}
