import type { ClassMetadataDefinition } from './ClassDescriptor.js';
import { VISIBLE_IF } from './commonProperties.js';

interface QuestionTypeDefinitions {
  readonly question: ClassMetadataDefinition;
  readonly text: ClassMetadataDefinition;
}

/** Authoritative metadata for the question base and plain question types. */
export const QUESTION_TYPE_DEFINITIONS: QuestionTypeDefinitions = {
  question: {
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
  },
  text: {
    name: 'text',
    parent: 'question',
    properties: [
      { name: 'inputType', type: 'string', defaultValue: 'text' },
      { name: 'placeholder', type: 'string' },
    ],
  },
};
