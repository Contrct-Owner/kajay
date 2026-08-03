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
      // One question asked of three subjects. Rows and columns are both `itemvalue`
      // collections — a matrix row is a choice in every respect that matters — and
      // `eachRowUnique` turns the grid into a ranking: each place may be used once.
      // Nothing here is required, so an untouched page still completes.
      type: 'matrix',
      name: 'comparison',
      title: 'Put these in order, one place each',
      eachRowUnique: true,
      alternateRows: true,
      columns: [
        { value: 1, text: 'First' },
        { value: 2, text: 'Second' },
        { value: 3, text: 'Third' },
      ],
      rows: [
        { value: 'docs', text: 'Documentation' },
        { value: 'support', text: 'Support' },
        { value: 'price', text: 'Price' },
      ],
    },
    {
      // Cells are questions. The column says `type`, and everything that type can do
      // works inside the table — the dropdown's choices, the comment's rows, and a
      // `{row.rating}` condition that means "the cell beside this one, in this row".
      type: 'matrixcells',
      name: 'areas',
      title: 'How are we doing in each area?',
      rows: [
        { value: 'docs', text: 'Documentation' },
        { value: 'support', text: 'Support' },
      ],
      columns: [
        {
          type: 'dropdown',
          name: 'rating',
          title: 'Rating',
          placeholder: 'Choose',
          choices: [
            { value: 'good', text: 'Good' },
            { value: 'poor', text: 'Poor' },
          ],
        },
        {
          type: 'comment',
          name: 'notes',
          title: 'What went wrong?',
          rows: 2,
          visibleIf: "{row.rating} = 'poor'",
        },
      ],
    },
    {
      // The same cells, with the rows in the respondent's hands. The total is declared
      // on the table rather than the column, because a question has no business
      // declaring a table footer.
      type: 'matrixdynamic',
      name: 'expenses',
      title: 'Anything to expense?',
      rowTitleFormat: 'Line {0}',
      addRowText: 'Add a line',
      confirmDelete: true,
      maxRowCount: 4,
      // The detail holds what does not fit across: a row of a table runs out of
      // horizontal room long before a form runs out of questions.
      detailPanelMode: 'underRow',
      columns: [
        { type: 'text', name: 'quantity', title: 'Quantity', inputType: 'number' },
        { type: 'text', name: 'unit', title: 'Unit price', inputType: 'number' },
        {
          // Computed from its own row. `{row.unit}` becomes a real path into this row
          // when the cell is built, so it is an ordinary expression question.
          type: 'expression',
          name: 'amount',
          title: 'Amount',
          expression: '{row.unit} * {row.quantity}',
        },
      ],
      detailElements: [{ type: 'comment', name: 'what', title: 'What was it for?', rows: 2 }],
      totals: [
        { column: 'quantity', kind: 'sum' },
        { column: 'amount', kind: 'sum', format: '{0}', precision: 2 },
        // A total computed from the other totals: `{row.amount}` here is that column's
        // own figure, one level up from what a cell condition means by `row`.
        { column: 'unit', expression: '{row.amount} / {row.quantity}', precision: 2 },
      ],
    },
    {
      // A whole form repeated for each of several things — and the same machinery the
      // matrix rows use, under the word that reads better here: `{panel.age}` is this
      // traveller's age. The template holds a group and a table of its own, neither of
      // which needed anything: a template is a list of page elements.
      type: 'paneldynamic',
      name: 'travellers',
      title: 'Who else is coming?',
      panelTitleFormat: 'Traveller {0}',
      addPanelText: 'Add a traveller',
      confirmDelete: true,
      maxPanelCount: 3,
      templateElements: [
        { type: 'text', name: 'fullName', title: 'Name' },
        { type: 'text', name: 'age', title: 'Age', inputType: 'number' },
        {
          type: 'panel',
          name: 'minorDetails',
          title: 'Travelling with a minor',
          visibleIf: '{panel.age} < 18',
          elements: [
            { type: 'text', name: 'guardian', title: 'Responsible adult', isRequired: true },
          ],
        },
      ],
    },
    {
      // The host stores it: `uploadFiles` is wired in `useDemoSurvey`, so the response
      // carries a reference rather than a megabyte of base64. Accepted types and the
      // size limit are rules the model enforces, not just hints to the picker.
      type: 'file',
      name: 'evidence',
      title: 'Attach your receipts',
      allowMultiple: true,
      acceptedTypes: 'image/*,.pdf,.txt',
      maxSize: 1048576,
      maxFileCount: 3,
    },
    {
      type: 'signaturepad',
      name: 'signature',
      title: 'Sign to confirm the expenses are yours',
      penColor: '#2f6feb',
      signatureHeight: 120,
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
