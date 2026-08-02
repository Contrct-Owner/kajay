import type { ClassMetadataDefinition } from './ClassDescriptor.js';

interface ValidatorTypeDefinitions {
  readonly validator: ClassMetadataDefinition;
  readonly numeric: ClassMetadataDefinition;
  readonly text: ClassMetadataDefinition;
  readonly regex: ClassMetadataDefinition;
  readonly email: ClassMetadataDefinition;
  readonly expression: ClassMetadataDefinition;
  readonly answerCount: ClassMetadataDefinition;
}

/**
 * Authoritative metadata for the validator base and every built-in check.
 *
 * The registered names carry a `validator` suffix because the registry is one flat
 * namespace: `text` and `expression` are already taken by question types, and a scheme
 * that only disambiguates the names that happen to collide today is a trap for whoever
 * adds the next type. SurveyJS writes these as `{"type": "text"}` and names the class
 * `textvalidator`; we use the class name in both places, which the checklist's
 * vocabulary caveat allows.
 */
export const VALIDATOR_TYPE_DEFINITIONS: ValidatorTypeDefinitions = {
  validator: {
    name: 'validator',
    isAbstract: true,
    properties: [
      {
        name: 'text',
        type: 'string',
        description: 'Replaces the built-in message when this check fails.',
      },
    ],
  },
  numeric: {
    name: 'numericvalidator',
    parent: 'validator',
    properties: [
      { name: 'minValue', type: 'number', description: 'Omit for no lower bound.' },
      { name: 'maxValue', type: 'number', description: 'Omit for no upper bound.' },
    ],
  },
  text: {
    name: 'textvalidator',
    parent: 'validator',
    properties: [
      { name: 'minLength', type: 'number' },
      { name: 'maxLength', type: 'number' },
      {
        name: 'allowDigits',
        type: 'boolean',
        defaultValue: true,
        description: 'Set false to reject an answer containing any digit.',
      },
    ],
  },
  regex: {
    name: 'regexvalidator',
    parent: 'validator',
    properties: [
      {
        name: 'regex',
        type: 'string',
        isRequired: true,
        description: 'Pattern the answer must match. Applied with the unicode flag.',
      },
    ],
  },
  email: { name: 'emailvalidator', parent: 'validator' },
  expression: {
    name: 'expressionvalidator',
    parent: 'validator',
    properties: [
      {
        name: 'expression',
        type: 'string',
        isRequired: true,
        description: 'The answer is acceptable while this evaluates truthy.',
      },
    ],
  },
  answerCount: {
    name: 'answercountvalidator',
    parent: 'validator',
    properties: [
      { name: 'minCount', type: 'number' },
      { name: 'maxCount', type: 'number' },
    ],
  },
};
