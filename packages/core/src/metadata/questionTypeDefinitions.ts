import type { ClassMetadataDefinition } from './ClassDescriptor.js';

interface QuestionTypeDefinitions {
  readonly question: ClassMetadataDefinition;
  readonly text: ClassMetadataDefinition;
  readonly comment: ClassMetadataDefinition;
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
        name: 'requiredErrorText',
        type: 'string',
        description: 'Replaces the built-in message shown when a required answer is missing.',
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
    childCollections: [{ property: 'validators', elementBaseType: 'validator' }],
  },
  text: {
    name: 'text',
    parent: 'question',
    properties: [
      {
        name: 'inputType',
        type: 'string',
        defaultValue: 'text',
        description:
          'text, number, email, date, datetime-local, time, tel, url, color, range or password.',
      },
      { name: 'placeholder', type: 'string' },
      {
        name: 'min',
        type: 'value',
        description: 'Lower bound. A number for numeric types, an ISO string for date ones.',
      },
      { name: 'max', type: 'value', description: 'Upper bound, read the same way as min.' },
      { name: 'step', type: 'number', description: '0 lets the browser choose.' },
    ],
  },
  comment: {
    name: 'comment',
    parent: 'question',
    properties: [
      { name: 'placeholder', type: 'string' },
      { name: 'rows', type: 'number', defaultValue: 4, description: 'Visible height, in lines.' },
      {
        name: 'autoGrow',
        type: 'boolean',
        description: 'Grow to fit the answer rather than scrolling.',
      },
      {
        name: 'allowResize',
        type: 'boolean',
        defaultValue: true,
        description: 'Whether the respondent may drag the field taller.',
      },
      {
        name: 'maxLength',
        type: 'number',
        description: 'Length budget. 0 means none, which also hides the counter.',
      },
    ],
  },
};
