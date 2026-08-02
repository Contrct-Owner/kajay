import type { PageDefinition } from '../pageDefinition.js';

/**
 * Page one: the conditional-logic chain.
 *
 * A name enables a nickname, which enables an email — each link registered from the
 * expression rather than declared, which is what §B is for.
 */
export const aboutYou: PageDefinition = {
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
};
