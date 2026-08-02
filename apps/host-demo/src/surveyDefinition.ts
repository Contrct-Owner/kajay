/**
 * The Phase 0 fixture, authored the way a host would author it.
 *
 * `department` is deliberately not a property the registry declares. It proves two
 * checklist rows at once: A1 (unknown properties are surfaced, not dropped) and A2
 * (they survive the round-trip verbatim).
 */
export const surveyDefinition: Readonly<Record<string, unknown>> = {
  title: 'Kajay Phase 0 demo',
  description: 'One question, rendered through the published package APIs.',
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
      ],
    },
  ],
};
