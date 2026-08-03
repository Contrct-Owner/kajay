import type { PageDefinition } from '../pageDefinition.js';

/**
 * Page two: value rules, panels and the trigger targets.
 */
export const logicShowcase: PageDefinition = {
  name: 'page2',
  title: 'Logic showcase',
  elements: [
    {
      type: 'radiogroup',
      name: 'plan',
      title: 'Which plan?',
      choices: ['free', 'paid'],
    },
    {
      // One `visibleIf` governs the group: nothing about billing is worth showing
      // until a plan is chosen. `state` makes it collapsible — a panel left at the
      // default is a grouping device, not a disclosure widget.
      type: 'panel',
      name: 'billing',
      title: 'Billing',
      state: 'expanded',
      visibleIf: '{plan} notempty',
      elements: [
        {
          type: 'text',
          name: 'price',
          title: 'Monthly price',
          inputType: 'number',
          // Forced to zero while the plan is free, overwriting whatever was typed.
          setValueIf: "{plan} == 'free'",
          setValueExpression: '0',
          // A bound, so the demo has something to fail that is not requiredness.
          validators: [{ type: 'numericvalidator', minValue: 0, maxValue: 1000 }],
        },
        {
          type: 'text',
          name: 'notes',
          title: 'Billing notes',
          // Cleared outright when they stop applying.
          resetValueIf: "{plan} == 'free'",
        },
        {
          // Panels nest, and the inner one inherits nothing: it is shown because
          // its parent is, and would hide independently if it had its own rule.
          type: 'panel',
          name: 'estimate',
          title: 'Estimate',
          elements: [
            {
              type: 'text',
              name: 'annualEstimate',
              title: 'Annual estimate',
              // Written by the runexpression trigger above.
            },
          ],
        },
      ],
    },
    {
      type: 'dropdown',
      name: 'primaryTopic',
      title: 'Which topic matters most?',
      placeholder: 'Pick from what you chose above',
      // Carried forward from the topics actually selected on the first page.
      choicesFromQuestion: 'topics',
      choicesFromQuestionMode: 'selected',
    },
    {
      type: 'text',
      name: 'contactName',
      title: 'Name on file',
      // Written by the copyvalue trigger above.
    },
    {
      type: 'radiogroup',
      name: 'finishNow',
      title: 'Finish the survey now?',
      choices: [
        { value: 'yes', text: 'Yes, finish now' },
        { value: 'no', text: 'Not yet' },
      ],
    },
  ],
};
