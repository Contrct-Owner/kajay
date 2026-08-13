import type { SurveyDefinition } from '@kajay/core';
import { HOST_CONTEXT_EXAMPLE } from './hostContextExample';

/**
 * A sentence that is a form — checklist C13.
 *
 * Every gap here is a different kind of question, which is the whole point of the type:
 * the prose is the layout, and what sits in it is a real field. Written as something a
 * person would actually say, because a demonstration of natural-language authoring that
 * reads like a form has demonstrated nothing.
 */
const FILL_IN_THE_BLANK_EXAMPLE: SurveyDefinition = {
  title: 'Tell us about your team',
  pages: [
    {
      name: 'p1',
      elements: [
        {
          type: 'fillintheblank',
          name: 'team',
          title: 'Complete the sentence',
          template:
            'My name is [[name]] and I work in [[department]]. '
            + 'Day to day my team uses [[tools]], and I would rate our tooling [[rating]]. '
            + 'It is [[remote]] that we work remotely, across [[seats]] seats — '
            + 'which is [[annual]] seat-months a year.',
          blanks: [
            { type: 'text', name: 'name', title: 'Your name' },
            {
              type: 'dropdown',
              name: 'department',
              title: 'Department',
              choices: ['Engineering', 'Design', 'Support', 'Sales'],
            },
            {
              type: 'tagbox',
              name: 'tools',
              title: 'Tools your team uses',
              choices: ['Kajay', 'Figma', 'Linear', 'Slack'],
            },
            { type: 'rating', name: 'rating', title: 'Tooling rating', rateMax: 5 },
            { type: 'boolean', name: 'remote', title: 'Works remotely' },
            { type: 'text', name: 'seats', title: 'Seats', inputType: 'number' },
            {
              type: 'expression',
              name: 'annual',
              title: 'Seat-months a year',
              expression: '{team.seats} * 12',
            },
          ],
        },
      ],
    },
  ],
  completedHtml: '<h3>Thanks!</h3><p>One sentence, five answers.</p>',
};

/** What a visitor can load, and what each one is for. */
export interface PlaygroundExample {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly definition: SurveyDefinition;
}

export const PLAYGROUND_EXAMPLES: readonly PlaygroundExample[] = [
  {
    id: 'fill-in-the-blank',
    title: 'A sentence that is a form',
    summary: 'Every gap is a different field: text, dropdown, multi-select, rating, yes/no and a computed total.',
    definition: FILL_IN_THE_BLANK_EXAMPLE,
  },
  {
    id: 'host-context',
    title: 'A survey that reads host context',
    summary: 'Conditions and computed values driven by `{$name}` values your application supplies.',
    definition: HOST_CONTEXT_EXAMPLE,
  },
];
