import type { SurveyDefinition } from '@kajay/core';

/**
 * A definition that reads the host scope, loaded on request rather than by default.
 *
 * **Opt-in, deliberately.** The starter document is what every visitor lands on and what
 * the drag-and-drop scenarios measure, and growing it to demonstrate one feature would
 * make the canvas taller for everyone and change the fixture those scenarios drag across.
 * A feature that needs an example should bring its own.
 */
export const HOST_CONTEXT_EXAMPLE: SurveyDefinition = {
  title: 'Renewal check-in',
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'contact', title: 'Who should we follow up with?' },
        // Nothing in this definition supplies `{$tier}` — that is the point. The
        // application does, and the panel beside the survey is standing in for it.
        {
          type: 'text',
          name: 'accountNotes',
          title: 'Anything for your account team?',
          visibleIf: "{$tier} = 'gold'",
        },
        {
          type: 'expression',
          name: 'annualSeats',
          title: 'Seats on your plan this year',
          expression: '{$seats} * 12',
        },
      ],
    },
  ],
  completedHtml: '<h3>Thanks!</h3><p>We will pass this to your {$tier} success team.</p>',
};
