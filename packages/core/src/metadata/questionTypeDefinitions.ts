import type { ClassMetadataDefinition } from './ClassDescriptor.js';

interface QuestionTypeDefinitions {
  readonly question: ClassMetadataDefinition;
  readonly text: ClassMetadataDefinition;
}

/** Authoritative metadata for the question base and plain question types. */
export const QUESTION_TYPE_DEFINITIONS: QuestionTypeDefinitions = {
  question: {
    name: 'question',
    parent: 'pageelement',
    isAbstract: true,
    properties: [
      { name: 'isRequired', type: 'boolean' },
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
