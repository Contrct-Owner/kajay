/**
 * The Phase 0 fixture, authored the way a host would author it.
 *
 * `department` is deliberately not a property the registry declares. It proves two
 * checklist rows at once: A1 (unknown properties are surfaced, not dropped) and A2
 * (they survive the round-trip verbatim).
 */
export const surveyDefinition: Readonly<Record<string, unknown>> = {
  // Deliberately not named for a phase: it goes stale every time the demo grows.
  title: 'Kajay demo',
  triggers: [
    {
      // Fires on the transition into true, so it stamps once rather than on every
      // keystroke afterwards.
      type: 'setvalue',
      expression: '{answeredCount} == 3',
      setToName: 'status',
      setValue: 'complete',
    },
  ],
  calculatedValues: [
    {
      name: 'answeredCount',
      expression: 'count({fullName}, {nickname}, {email})',
      // Included, so it joins the answers and shows up in the panel below.
      includeIntoResult: true,
    },
  ],
  description: 'Conditional logic, rendered through the published package APIs.',
  pages: [
    {
      name: 'page1',
      title: 'About you',
      elements: [
        {
          type: 'text',
          name: 'fullName',
          title: 'What is your name?',
          isRequired: true,
          placeholder: 'Ada Lovelace',
          department: 'engineering',
        },
        {
          type: 'text',
          name: 'nickname',
          title: 'What should we call you?',
          placeholder: 'Ada',
          // Hidden until there is a name to shorten. The expression is evaluated by
          // the engine and re-evaluated only when `fullName` changes.
          visibleIf: '{fullName} notempty',
          // Once shown, an answer is expected.
          requiredIf: '{fullName} notempty',
        },
        {
          type: 'text',
          name: 'email',
          title: 'Email address',
          inputType: 'email',
          placeholder: 'ada@example.com',
          // Editable only once we know what to call them: a second link in the chain,
          // which the dependency graph orders without being told.
          enableIf: '{nickname} notempty',
        },
        {
          type: 'text',
          name: 'status',
          title: 'Status',
          // Written by the trigger above once everything is answered.
          visibleIf: '{status} notempty',
        },
        {
          type: 'checkbox',
          name: 'topics',
          title: 'What should we talk about?',
          choices: ['engineering', 'design', { value: 'management', visibleIf: '{seniority} == 1' }],
          showNoneItem: true,
        },
        {
          type: 'radiogroup',
          name: 'seniority',
          title: 'How senior are you?',
          choices: [
            { value: 0, text: 'Individual contributor' },
            { value: 1, text: 'Manager' },
          ],
        },
        {
          type: 'text',
          name: 'greeting',
          title: 'How we will greet you',
          // Prefilled from the answers above and kept in step with them — until you
          // type over it, after which it is yours.
          //
          // Guarded with iif because a hidden question's rules still run: clearing
          // values for invisible questions is §E9 and does not exist yet, so without
          // this the survey would carry a half-built "Hello, " from the start.
          defaultValueExpression: "iif({nickname} notempty, 'Hello, ' + {nickname}, '')",
          visibleIf: '{nickname} notempty',
        },
      ],
    },
  ],
};
