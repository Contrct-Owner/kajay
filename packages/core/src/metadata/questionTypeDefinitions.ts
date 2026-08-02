import type { ClassMetadataDefinition } from './ClassDescriptor.js';

interface QuestionTypeDefinitions {
  readonly question: ClassMetadataDefinition;
  readonly text: ClassMetadataDefinition;
  readonly comment: ClassMetadataDefinition;
  readonly boolean: ClassMetadataDefinition;
  readonly rating: ClassMetadataDefinition;
  readonly expression: ClassMetadataDefinition;
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
  boolean: {
    name: 'boolean',
    parent: 'question',
    properties: [
      { name: 'labelTrue', type: 'string', defaultValue: 'Yes' },
      { name: 'labelFalse', type: 'string', defaultValue: 'No' },
      {
        name: 'valueTrue',
        type: 'value',
        defaultValue: true,
        description: 'What is stored for yes. Anything the host backend expects.',
      },
      { name: 'valueFalse', type: 'value', defaultValue: false },
      {
        name: 'renderAs',
        type: 'string',
        defaultValue: 'switch',
        description: 'switch or radio.',
      },
    ],
  },
  rating: {
    name: 'rating',
    parent: 'question',
    properties: [
      { name: 'rateMin', type: 'number', defaultValue: 1 },
      { name: 'rateMax', type: 'number', defaultValue: 5 },
      { name: 'rateStep', type: 'number', defaultValue: 1 },
      {
        name: 'rateType',
        type: 'string',
        defaultValue: 'labels',
        description: 'labels, stars or smileys.',
      },
      {
        name: 'displayMode',
        type: 'string',
        defaultValue: 'auto',
        description: 'auto, buttons or dropdown. auto collapses a long scale.',
      },
      { name: 'minRateDescription', type: 'string' },
      { name: 'maxRateDescription', type: 'string' },
    ],
    childCollections: [
      { property: 'rateValues', elementBaseType: 'itemvalue', shorthandProperty: 'value' },
    ],
  },
  expression: {
    name: 'expression',
    parent: 'question',
    properties: [
      {
        name: 'expression',
        type: 'string',
        isRequired: true,
        description: 'Computed from the answers. The respondent does not supply it.',
      },
      {
        name: 'displayStyle',
        type: 'string',
        defaultValue: 'none',
        description: 'none, decimal, currency, percent or date.',
      },
      { name: 'currency', type: 'string', defaultValue: 'USD' },
      { name: 'maximumFractionDigits', type: 'number', description: '0 leaves it to the style.' },
      {
        name: 'format',
        type: 'string',
        description: 'Template around the result, with {0} standing for it.',
      },
    ],
  },
};
