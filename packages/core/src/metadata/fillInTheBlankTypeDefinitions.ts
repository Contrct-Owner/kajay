import type { ClassMetadataDefinition } from './ClassDescriptor.js';

interface FillInTheBlankTypeDefinitions {
  readonly fillInTheBlankItem: ClassMetadataDefinition;
  readonly fillInTheBlank: ClassMetadataDefinition;
}

/**
 * Metadata for the fill-in-the-blank question and the blanks it positions — checklist C13.
 *
 * Its own file, as the select and matrix families have theirs: the question file was at the
 * size limit, and a family whose two types are only ever read together is the split the
 * limit is asking for.
 */
export const FILL_IN_THE_BLANK_TYPE_DEFINITIONS: FillInTheBlankTypeDefinitions = {
  fillInTheBlankItem: {
    name: 'fillintheblankitem',
    properties: [
      {
        name: 'name',
        type: 'string',
        isRequired: true,
        description: 'Key this blank is stored under inside the question answer.',
      },
      {
        name: 'label',
        type: 'string',
        isLocalizable: true,
        description:
          'What a screen reader calls this blank; falls back to name. The sentence labels '
          + 'it visually and not programmatically.',
      },
      { name: 'inputType', type: 'string', defaultValue: 'text' },
      { name: 'placeholder', type: 'string', isLocalizable: true },
      { name: 'isRequired', type: 'boolean' },
      {
        name: 'valueName',
        type: 'string',
        description: 'Answer key, when it should differ from the name. Shared keys share an answer.',
      },
      { name: 'requiredErrorText', type: 'string', isLocalizable: true },
      { name: 'size', type: 'number', description: 'Width in characters. 0 uses blankSize.' },
      {
        name: 'correctAnswer',
        type: 'json',
        description: 'The answer that scores this blank. A blank without one is not marked.',
      },
      {
        name: 'trim',
        type: 'boolean',
        defaultValue: true,
        description: 'Ignore surrounding whitespace when marking.',
      },
      {
        name: 'caseSensitive',
        type: 'boolean',
        description: 'Require matching case when marking. Off by default.',
      },
    ],
    childCollections: [{ property: 'validators', elementBaseType: 'validator' }],
  },
  fillInTheBlank: {
    name: 'fillintheblank',
    parent: 'question',
    properties: [
      {
        name: 'template',
        type: 'string',
        isRequired: true,
        isLocalizable: true,
        description: 'Prose with [[name]] marking each blank. Translators may move a marker.',
      },
      {
        name: 'blankSize',
        type: 'number',
        description: 'Default blank width in characters. A blank size wins.',
      },
    ],
    childCollections: [{ property: 'blanks', elementBaseType: 'fillintheblankitem' }],
  },
};
