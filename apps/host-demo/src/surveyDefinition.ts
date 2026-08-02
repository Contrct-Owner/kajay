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
      // Writes annualEstimate from price when the plan becomes paid.
      type: 'runexpression',
      expression: "{plan} == 'paid'",
      runExpression: '{price} * 12',
      setToName: 'annualEstimate',
    },
    {
      // Snapshots the name once a primary topic is picked.
      type: 'copyvalue',
      expression: '{primaryTopic} notempty',
      setToName: 'contactName',
      fromName: 'fullName',
    },
    {
      type: 'complete',
      expression: "{finishNow} == 'yes'",
    },
    {
      // The mirror image: not finishing sends you back to review. `skip` had no
      // observable effect until the renderer paginated — it moves `currentPageNo`, and
      // with every page on screen at once there was nothing to see.
      type: 'skip',
      expression: "{finishNow} == 'no'",
      gotoName: 'page1',
    },
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
          requiredErrorText: 'We need a name to address you by.',
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
          // A check the host registered, which has to leave the process to answer.
          // Try "admin".
          validators: [{ type: 'reservednamevalidator' }],
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
          // The browser's own `type=email` check is off (the form is `noValidate`), so
          // this is the engine's, and it produces a message the model owns.
          validators: [{ type: 'emailvalidator' }],
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
          type: 'dropdown',
          name: 'timezone',
          title: 'Where are you?',
          placeholder: 'Choose a region',
          choices: ['Europe', 'Americas', 'Asia-Pacific'],
        },
        {
          type: 'dropdown',
          name: 'contact',
          title: 'Who should we contact?',
          // Not "Loading…": nothing clears a placeholder once the list arrives, and
          // the model carries no loading flag for a renderer to show one.
          placeholder: 'Choose a contact',
          // A real HTTP call, made by the host's fetcher. The response is the array
          // itself, so no choicesPath is needed.
          choicesByUrl: 'https://jsonplaceholder.typicode.com/users',
          choicesValueName: 'id',
          choicesTitleName: 'name',
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
    {
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
    },
  ],
};
