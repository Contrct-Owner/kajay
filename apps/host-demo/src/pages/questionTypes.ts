import type { PageDefinition } from '../pageDefinition.js';

/** A flat colour rectangle, so the demo needs no image host. */
function swatch(hex: string): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='60'%3E%3Crect width='90' height='60' fill='%23${hex}'/%3E%3C/svg%3E`;
}

/**
 * Page three: one of every question type §C declares.
 *
 * Its own page because these have nothing to do with the logic the pages before them
 * demonstrate, and because §C adds a type at a time.
 */
export const questionTypes: PageDefinition = {
  name: 'page3',
  title: 'Question types',
  elements: [
    {
      // Markup, rendered as markup. The demo supplies no sanitizer because it
      // authors its own definition — a host that does not must pass one.
      type: 'html',
      name: 'intro',
      html: '<p>These are the built-in types. <strong>Nothing here is required.</strong></p>',
    },
    {
      type: 'text',
      name: 'startDate',
      title: 'When would you like to start?',
      inputType: 'date',
      // Bounds the browser offers as affordances and the engine enforces as rules.
      min: '2026-01-01',
      max: '2026-12-31',
    },
    {
      type: 'text',
      name: 'teamSize',
      title: 'How many people on your team?',
      inputType: 'number',
      min: 1,
      max: 500,
      step: 1,
    },
    {
      // Held by the respondent's response and filled in by the engine. Read-only is
      // what makes that pair work: they may not type into it, and something else must
      // be able to.
      type: 'text',
      name: 'reference',
      title: 'Your reference',
      readOnly: true,
      defaultValueExpression: "'KJ-' + {teamSize}",
    },
    {
      // The argument to the host's asynchronous `isServed` lookup below.
      type: 'text',
      name: 'postcode',
      title: 'Delivery postcode',
      placeholder: 'SW1',
    },
    {
      // Shown only once a lookup that leaves the process says so. The expression is
      // evaluated synchronously and the answer arrives later, so this appears a moment
      // after the postcode is typed rather than with it.
      type: 'html',
      name: 'deliveryNote',
      visibleIf: 'isServed({postcode})',
      html: '<p><strong>Good news:</strong> we deliver to that postcode.</p>',
    },
    {
      type: 'comment',
      name: 'feedback',
      title: 'Anything else we should know?',
      placeholder: 'Type as much as you like — the field grows to fit.',
      rows: 3,
      autoGrow: true,
      maxLength: 120,
    },
    {
      // Several fields, one answer. `{workplace.city}` reaches a single field from
      // anywhere, because the answer is a real object rather than a flat prefix.
      type: 'multipletext',
      name: 'workplace',
      title: 'Where do you work?',
      colCount: 2,
      itemSize: 18,
      items: [
        { name: 'street', title: 'Street', isRequired: true },
        { name: 'city', title: 'City' },
        {
          name: 'postcode',
          title: 'Postcode',
          size: 8,
          validators: [
            { type: 'regexvalidator', regex: '^[0-9]{5}$', text: 'Five digits, please.' },
          ],
        },
      ],
    },
    {
      type: 'boolean',
      name: 'wantsUpdates',
      title: 'Product updates',
      labelTrue: 'Email me when something ships',
    },
    {
      // The radio form, and a pair of values the backend chose rather than the
      // booleans. Both halves of C7 in one question.
      type: 'boolean',
      name: 'hasBudget',
      title: 'Do you have a budget approved?',
      renderAs: 'radio',
      labelTrue: 'Approved',
      labelFalse: 'Not yet',
      valueTrue: 'approved',
      valueFalse: 'pending',
    },
    {
      // Data URIs so the demo depends on no host for its pictures.
      type: 'imagepicker',
      name: 'palette',
      title: 'Pick the colours you like',
      multiSelect: true,
      showLabel: true,
      imageWidth: 90,
      imageHeight: 60,
      choices: [
        { value: 'blue', text: 'Blue', imageLink: swatch('2f6feb') },
        { value: 'green', text: 'Green', imageLink: swatch('12b76a') },
        { value: 'amber', text: 'Amber', imageLink: swatch('f79009') },
      ],
    },
    {
      // Too long to send at once, so it arrives a page at a time and the search goes
      // to the host — the matching entry may never have been loaded.
      type: 'dropdown',
      name: 'city',
      title: 'Which office are you nearest?',
      placeholder: 'Choose a city',
      choicesLazyLoadEnabled: true,
      choicesLazyLoadPageSize: 8,
    },
    {
      // Ordered, not picked: the answer is an array whose positions carry the meaning,
      // so `{priorities[0]}` is "what matters most".
      type: 'ranking',
      name: 'priorities',
      title: 'What matters most to you?',
      choices: [
        { value: 'speed', text: 'Speed' },
        { value: 'price', text: 'Price' },
        { value: 'support', text: 'Support' },
      ],
    },
    {
      // The other shape of the same question: choices start in a pool, and only what
      // has been placed is part of the answer.
      type: 'ranking',
      name: 'shortlist',
      title: 'Which two should we build next, best first?',
      selectToRankEnabled: true,
      selectToRankAreasLayout: 'horizontal',
      maxSelectedChoices: 2,
      choices: [
        { value: 'offline', text: 'Offline mode' },
        { value: 'sso', text: 'Single sign-on' },
        { value: 'api', text: 'Public API' },
        { value: 'themes', text: 'Custom themes' },
      ],
    },
    {
      type: 'rating',
      name: 'satisfaction',
      title: 'How is it going so far?',
      rateType: 'stars',
      rateMax: 5,
    },
    {
      // Eleven steps, so `auto` collapses it to a list rather than a wall of
      // buttons. Nothing in the definition says "dropdown".
      type: 'rating',
      name: 'recommend',
      title: 'How likely are you to recommend Kajay?',
      rateMin: 0,
      rateMax: 10,
      minRateDescription: 'Not at all likely',
      maxRateDescription: 'Extremely likely',
    },
    {
      // Read-only and computed. Shown only once there is something to compute, so
      // the page does not open with "$0.00" against a question nobody has answered.
      type: 'expression',
      name: 'annualCost',
      title: 'Estimated annual cost',
      expression: '{price} * 12 * {teamSize}',
      displayStyle: 'currency',
      visibleIf: '{teamSize} notempty',
    },
    {
      type: 'image',
      name: 'logo',
      title: 'Kajay',
      // A data URI, so the demo depends on no host for a picture.
      imageLink:
        'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%2240%22%3E%3Crect width=%22120%22 height=%2240%22 rx=%228%22 fill=%22%232f6feb%22/%3E%3Ctext x=%2260%22 y=%2226%22 font-family=%22sans-serif%22 font-size=%2216%22 fill=%22white%22 text-anchor=%22middle%22%3EKajay%3C/text%3E%3C/svg%3E',
      altText: 'The Kajay wordmark',
      imageWidth: 120,
      imageHeight: 40,
    },
  ],
};
