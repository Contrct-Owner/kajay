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
      ],
    },
  ],
};
