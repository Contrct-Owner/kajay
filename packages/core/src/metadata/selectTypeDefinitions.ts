import type { ClassMetadataDefinition } from './ClassDescriptor.js';
import { VISIBLE_IF } from './commonProperties.js';

interface SelectTypeDefinitions {
  readonly itemValue: ClassMetadataDefinition;
  readonly selectBase: ClassMetadataDefinition;
  readonly multiSelectBase: ClassMetadataDefinition;
  readonly radiogroup: ClassMetadataDefinition;
  readonly dropdown: ClassMetadataDefinition;
  readonly checkbox: ClassMetadataDefinition;
  readonly tagbox: ClassMetadataDefinition;
}

/** Authoritative metadata for choice items and every select-question type. */
export const SELECT_TYPE_DEFINITIONS: SelectTypeDefinitions = {
  itemValue: {
    name: 'itemvalue',
    properties: [
      { name: 'value', type: 'value', isRequired: true },
      { name: 'text', type: 'string', description: 'Display text; falls back to the value.' },
      { ...VISIBLE_IF, description: 'Expression; the choice is offered only while truthy.' },
    ],
  },
  selectBase: {
    name: 'selectbase',
    parent: 'question',
    isAbstract: true,
    properties: [
      { name: 'choicesOrder', type: 'string', description: 'none, asc or desc.' },
      { name: 'colCount', type: 'number' },
      { name: 'showOtherItem', type: 'boolean' },
      { name: 'otherText', type: 'string', defaultValue: 'Other' },
      { name: 'showNoneItem', type: 'boolean' },
      { name: 'noneText', type: 'string', defaultValue: 'None' },
      { name: 'placeholder', type: 'string' },
      {
        name: 'searchEnabled',
        type: 'boolean',
        defaultValue: true,
        description: 'Whether a long list may be narrowed by typing.',
      },
      {
        name: 'choicesFromQuestion',
        type: 'string',
        description: 'Name of a select question whose choices are carried forward.',
      },
      {
        name: 'choicesFromQuestionMode',
        type: 'string',
        defaultValue: 'all',
        description: 'all, selected or unselected.',
      },
      {
        name: 'choicesByUrl',
        type: 'string',
        description: 'URL to load choices from; may interpolate {question} placeholders.',
      },
      {
        name: 'choicesPath',
        type: 'string',
        description: 'Dotted path to the array inside the response.',
      },
      { name: 'choicesValueName', type: 'string' },
      { name: 'choicesTitleName', type: 'string' },
    ],
    childCollections: [
      { property: 'choices', elementBaseType: 'itemvalue', shorthandProperty: 'value' },
    ],
  },
  multiSelectBase: {
    name: 'multiselectbase',
    parent: 'selectbase',
    isAbstract: true,
    properties: [
      { name: 'showSelectAllItem', type: 'boolean' },
      { name: 'selectAllText', type: 'string', defaultValue: 'Select all' },
      { name: 'maxSelectedChoices', type: 'number', description: '0 means no limit.' },
    ],
  },
  radiogroup: {
    name: 'radiogroup',
    parent: 'selectbase',
    properties: [{ name: 'showClearButton', type: 'boolean' }],
  },
  dropdown: { name: 'dropdown', parent: 'selectbase' },
  checkbox: { name: 'checkbox', parent: 'multiselectbase' },
  tagbox: { name: 'tagbox', parent: 'multiselectbase' },
};
