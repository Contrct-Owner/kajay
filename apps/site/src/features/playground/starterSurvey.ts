import type { SurveyDefinition } from '@kajay/core';

/** The local document opened when no valid shared definition is present. */
export const STARTER_SURVEY: SurveyDefinition = {
  title: 'Customer feedback',
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'name', title: 'What is your name?' },
        {
          type: 'radiogroup',
          name: 'rating',
          title: 'How was it?',
          choices: ['Great', 'Fine', 'Poor'],
        },
        { type: 'comment', name: 'notes', title: 'Anything else?' },
      ],
    },
  ],
};
