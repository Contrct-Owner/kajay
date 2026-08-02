import { CheckboxQuestion } from '../model/CheckboxQuestion.js';
import { DropdownQuestion } from '../model/DropdownQuestion.js';
import { ItemValue } from '../model/ItemValue.js';
import { RadiogroupQuestion } from '../model/RadiogroupQuestion.js';
import { TagboxQuestion } from '../model/TagboxQuestion.js';
import { VISIBLE_IF } from './commonProperties.js';
import type { MetadataRegistry } from './MetadataRegistry.js';

function registerChoiceItemType(registry: MetadataRegistry): void {
  registry.addClass({
    name: 'itemvalue',
    properties: [
      { name: 'value', type: 'value', isRequired: true },
      { name: 'text', type: 'string', description: 'Display text; falls back to the value.' },
      { ...VISIBLE_IF, description: 'Expression; the choice is offered only while truthy.' },
    ],
    create: () => new ItemValue(),
  });
}

/** Abstract base for questions answered by picking from a list. */
function registerSelectBase(registry: MetadataRegistry): void {
  registry.addClass({
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
      // `choices: ["a", "b"]` is how choice lists are actually written.
      { property: 'choices', elementBaseType: 'itemvalue', shorthandProperty: 'value' },
    ],
  });
}

/**
 * Abstract base for the multi-select types.
 *
 * Selection arity, not widget, is what these properties belong to: checkbox and tagbox
 * differ in how they look, not in what picking several choices means.
 */
function registerMultiSelectBase(registry: MetadataRegistry): void {
  registry.addClass({
    name: 'multiselectbase',
    parent: 'selectbase',
    isAbstract: true,
    properties: [
      { name: 'showSelectAllItem', type: 'boolean' },
      { name: 'selectAllText', type: 'string', defaultValue: 'Select all' },
      { name: 'maxSelectedChoices', type: 'number', description: '0 means no limit.' },
    ],
  });
}

function registerConcreteSelectTypes(registry: MetadataRegistry): void {
  registry.addClass({
    name: 'radiogroup',
    parent: 'selectbase',
    properties: [{ name: 'showClearButton', type: 'boolean' }],
    create: () => new RadiogroupQuestion(),
  });

  registry.addClass({ name: 'dropdown', parent: 'selectbase', create: () => new DropdownQuestion() });

  registry.addClass({
    name: 'checkbox',
    parent: 'multiselectbase',
    create: () => new CheckboxQuestion(),
  });

  registry.addClass({
    name: 'tagbox',
    parent: 'multiselectbase',
    create: () => new TagboxQuestion(),
  });
}

/** Choice items and every question answered by picking from them. */
export function registerSelectTypes(registry: MetadataRegistry): void {
  registerChoiceItemType(registry);
  registerSelectBase(registry);
  registerMultiSelectBase(registry);
  registerConcreteSelectTypes(registry);
}
