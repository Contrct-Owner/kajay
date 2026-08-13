import type { ClassMetadataDefinition } from './ClassDescriptor.js';

interface QuestionTypeDefinitions {
  readonly question: ClassMetadataDefinition;
  readonly text: ClassMetadataDefinition;
  readonly comment: ClassMetadataDefinition;
  readonly boolean: ClassMetadataDefinition;
  readonly rating: ClassMetadataDefinition;
  readonly expression: ClassMetadataDefinition;
  readonly multipleTextItem: ClassMetadataDefinition;
  readonly multipleText: ClassMetadataDefinition;
}

/** Authoritative metadata for the question base and plain question types. */
export const QUESTION_TYPE_DEFINITIONS: QuestionTypeDefinitions = {
  question: {
    name: 'question',
    parent: 'pageelement',
    isAbstract: true,
    properties: [
      {
        name: 'isRequired',
        type: 'boolean',
        // Not hidden: the value still matters the moment the expression is cleared, so
        // hiding it would lose a setting a designer had made.
        readOnlyIf: '{requiredIf} notempty',
      },
      {
        name: 'valueName',
        type: 'string',
        description: 'Answer key, when it should differ from the name. Shared keys share an answer.',
      },
      {
        name: 'readOnly',
        type: 'boolean',
        description: 'The answer is shown but cannot be changed by the respondent.',
      },
      {
        name: 'requiredIf',
        type: 'string',
        isExpression: true,
        description: 'Expression; when present it overrides isRequired.',
      },
      {
        name: 'requiredErrorText',
        type: 'string',
        isLocalizable: true,
        visibleIf: '{isRequired} = true or {requiredIf} notempty',
        description: 'Replaces the built-in message shown when a required answer is missing.',
      },
      {
        name: 'defaultValueExpression',
        type: 'string',
        isExpression: true,
        description: 'Expression supplying a value while the question is unanswered.',
      },
      {
        name: 'setValueIf',
        type: 'string',
        isExpression: true,
        description: 'Expression; while truthy, setValueExpression drives the answer.',
      },
      {
        name: 'setValueExpression',
        type: 'string',
        isExpression: true,
        visibleIf: '{setValueIf} notempty',
      },
      {
        name: 'resetValueIf',
        type: 'string',
        isExpression: true,
        description: 'Expression; while truthy the answer is cleared. Wins over the others.',
      },
      {
        name: 'correctAnswer',
        type: 'json',
        description:
          'The answer that scores. A question without one is not part of the quiz. Never shown.',
      },
      {
        name: 'trim',
        type: 'boolean',
        defaultValue: true,
        // Marking options, so they are offered only once there is marking to configure —
        // L3's rule. Shown always, they would be two questions about grading on every
        // question that is not graded.
        visibleIf: '{correctAnswer} notempty',
        description: 'Ignore surrounding whitespace when marking by text.',
      },
      {
        name: 'caseSensitive',
        type: 'boolean',
        visibleIf: '{correctAnswer} notempty',
        description:
          'Require matching case when marking by text. Off by default: an assessment '
          + 'marking "paris" wrong is measuring typing rather than the subject.',
      },
    ],
    childCollections: [{ property: 'validators', elementBaseType: 'validator' }],
  },
  text: {
    name: 'text',
    parent: 'question',
    // One control on one line: the case the whole feature is named after.
    allowsInline: true,
    properties: [
      {
        name: 'inputType',
        type: 'string',
        defaultValue: 'text',
        description:
          'text, number, email, date, datetime-local, time, tel, url, color, range or password.',
      },
      { name: 'placeholder', type: 'string', isLocalizable: true },
      {
        name: 'min',
        type: 'value',
        description: 'Lower bound. A number for numeric types, an ISO string for date ones.',
      },
      { name: 'max', type: 'value', description: 'Upper bound, read the same way as min.' },
      {
        name: 'step',
        type: 'number',
        visibleIf: "{inputType} = 'number' or {inputType} = 'range'",
        description: '0 lets the browser choose.',
      },
    ],
  },
  comment: {
    name: 'comment',
    parent: 'question',
    properties: [
      { name: 'placeholder', type: 'string', isLocalizable: true },
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
        visibleIf: '{autoGrow} = false',
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
    allowsInline: true,
    properties: [
      { name: 'labelTrue', type: 'string',
        isLocalizable: true, defaultValue: 'Yes' },
      { name: 'labelFalse', type: 'string',
        isLocalizable: true, defaultValue: 'No' },
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
    allowsInline: true,
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
      { name: 'minRateDescription', type: 'string', isLocalizable: true },
      { name: 'maxRateDescription', type: 'string', isLocalizable: true },
    ],
    childCollections: [
      { property: 'rateValues', elementBaseType: 'itemvalue', shorthandProperty: 'value' },
    ],
  },
  expression: {
    name: 'expression',
    parent: 'question',
    // Read-only and computed, so a sentence can state a total mid-clause.
    allowsInline: true,
    properties: [
      {
        name: 'expression',
        type: 'string',
        isRequired: true,
        isExpression: true,
        description: 'Computed from the answers. The respondent does not supply it.',
      },
      {
        name: 'displayStyle',
        type: 'string',
        defaultValue: 'none',
        description: 'none, decimal, currency, percent or date.',
      },
      {
        name: 'currency',
        type: 'string',
        defaultValue: 'USD',
        visibleIf: "{displayStyle} = 'currency'",
      },
      {
        name: 'maximumFractionDigits',
        type: 'number',
        visibleIf: "{displayStyle} <> 'none'",
        description: '0 leaves it to the style.',
      },
      {
        name: 'format',
        type: 'string',
        description: 'Template around the result, with {0} standing for it.',
      },
    ],
  },
  multipleTextItem: {
    name: 'multipletextitem',
    properties: [
      {
        name: 'name',
        type: 'string',
        isRequired: true,
        description: 'Key this field is stored under inside the question answer.',
      },
      { name: 'title', type: 'string',
        isLocalizable: true, description: 'Display label; falls back to name.' },
      { name: 'inputType', type: 'string', defaultValue: 'text' },
      { name: 'placeholder', type: 'string', isLocalizable: true },
      { name: 'isRequired', type: 'boolean' },
      {
        name: 'valueName',
        type: 'string',
        description: 'Answer key, when it should differ from the name. Shared keys share an answer.',
      },
      {
        name: 'readOnly',
        type: 'boolean',
        description: 'The answer is shown but cannot be changed by the respondent.',
      },
      { name: 'requiredErrorText', type: 'string', isLocalizable: true },
      { name: 'size', type: 'number', description: 'Width in characters. 0 uses itemSize.' },
    ],
    childCollections: [{ property: 'validators', elementBaseType: 'validator' }],
  },
  multipleText: {
    name: 'multipletext',
    parent: 'question',
    properties: [
      {
        name: 'itemSize',
        type: 'number',
        description: 'Default field width in characters. An item size wins.',
      },
      { name: 'colCount', type: 'number', defaultValue: 1 },
    ],
    childCollections: [{ property: 'items', elementBaseType: 'multipletextitem' }],
  },
};
