import { PanelDynamicQuestion, parseSurvey, serializeSurvey } from '@kajay/core';
import type { MatrixDynamicQuestion, Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

/**
 * Composites inside composites — checklist G4.
 *
 * The interesting claim is that this needed no feature: a template is a list of *page
 * elements*, so a panel in one is a panel and a matrix in one is a matrix. What it did
 * need was for a repeating question created at runtime to be handed the registry its own
 * instances are built from, since `parseSurvey` can only reach the questions on a page.
 */
const TRIP = {
  type: 'paneldynamic',
  name: 'trips',
  title: 'Your trips',
  panelTitleFormat: 'Trip {0}',
  templateElements: [
    { type: 'text', name: 'destination', title: 'Where to?' },
    {
      // A panel inside the template: a group, with a condition of its own that reads
      // the instance it is in.
      type: 'panel',
      name: 'insurance',
      title: 'Insurance',
      visibleIf: "{panel.destination} notempty",
      elements: [
        { type: 'boolean', name: 'insured', title: 'Insured?', isRequired: true },
        { type: 'text', name: 'policy', title: 'Policy number', visibleIf: '{panel.insured}' },
      ],
    },
    {
      // And a matrix inside the template, which has to build cells of its own.
      type: 'matrixdynamic',
      name: 'legs',
      title: 'Legs of the journey',
      minRowCount: 1,
      columns: [
        { type: 'text', name: 'from', title: 'From' },
        { type: 'text', name: 'to', title: 'To' },
      ],
    },
  ],
};

function build(): Survey {
  return parseSurvey(
    { pages: [{ name: 'p1', elements: [TRIP] }] },
    createTestRegistry(),
  ).survey;
}

function trips(survey: Survey): PanelDynamicQuestion {
  const question = survey.getQuestionByName('trips');
  if (!(question instanceof PanelDynamicQuestion)) {
    throw new TypeError('expected a dynamic panel');
  }
  return question;
}

function answer(survey: Survey, index: string, name: string, value: unknown): void {
  const cell = trips(survey).cellAt(index, name);
  if (cell === undefined) {
    throw new Error(`no question ${index}.${name}`);
  }
  cell.value = value;
}

describe('parity/G4-nested-composites', () => {
  test('a panel inside the template groups questions that answer into the instance', () => {
    const survey = build();
    answer(survey, '0', 'destination', 'Lisbon');
    answer(survey, '0', 'insured', true);

    // Flat inside the record: a panel is structure, and structure is not a level of the
    // answer — exactly as a panel on a page does not nest `data`.
    expect(survey.data).toEqual({ trips: [{ destination: 'Lisbon', insured: true }] });
  });

  test("a nested panel's own condition reads the instance it is in", () => {
    const survey = build();
    const insurance = trips(survey)
      .elementsFor('0')
      .find((element) => element.name === 'insurance');

    expect(insurance?.isVisible).toBe(false);

    answer(survey, '0', 'destination', 'Lisbon');
    expect(insurance?.isVisible).toBe(true);
  });

  test('a question inside a nested panel is still scoped to the instance', () => {
    const survey = build();
    trips(survey).addPanel();
    answer(survey, '1', 'insured', true);

    expect(trips(survey).cellAt('1', 'policy')?.isVisible).toBe(true);
    expect(trips(survey).cellAt('0', 'policy')?.isVisible).toBe(false);
  });

  test('a matrix inside the template builds its own cells', () => {
    const survey = build();
    const legs = trips(survey).cellAt('0', 'legs') as MatrixDynamicQuestion | undefined;
    if (legs === undefined) {
      throw new Error('expected the nested matrix');
    }

    // The nested matrix was created long after parsing, so it was handed the registry by
    // the instance that copied it. Without that it would render as a table with no cells.
    const from = legs.cellAt('0', 'from');
    expect(from).toBeDefined();
    from!.value = 'London';

    expect(survey.data).toEqual({ trips: [{ legs: [{ from: 'London' }] }] });
  });

  test('two instances of a nested matrix are separate', () => {
    const survey = build();
    trips(survey).addPanel();
    const first = trips(survey).cellAt('0', 'legs') as MatrixDynamicQuestion;
    const second = trips(survey).cellAt('1', 'legs') as MatrixDynamicQuestion;
    first.cellAt('0', 'from')!.value = 'London';
    second.cellAt('0', 'from')!.value = 'Porto';

    expect(survey.data).toEqual({
      trips: [{ legs: [{ from: 'London' }] }, { legs: [{ from: 'Porto' }] }],
    });
  });

  test('everything nested is checked with the instance that holds it', () => {
    const survey = parseSurvey(
      {
        pages: [
          {
            name: 'p1',
            elements: [
              {
                ...TRIP,
                templateElements: [
                  {
                    type: 'panel',
                    name: 'who',
                    elements: [{ type: 'text', name: 'traveller', isRequired: true }],
                  },
                ],
              },
            ],
          },
        ],
      },
      createTestRegistry(),
    ).survey;
    survey.validation.validateCurrentPage();

    expect((survey.getQuestionByName('trips')?.errors ?? []).map((error) => error.path)).toEqual([
      '0.traveller',
    ]);
  });

  test('a question inside a nested group is named and identified per instance', () => {
    const survey = build();
    survey.setValue('trips', [{}, {}]);
    const first = trips(survey).cellAt('0', 'policy');
    const second = trips(survey).cellAt('1', 'policy');

    // Two levels down, and still told apart. Sharing a title makes two identical labels;
    // sharing an instance key makes two identical DOM ids, which a browser resolves by
    // pointing both labels at the first input — so typing into the second instance wrote
    // into the first. An E2E caught this after the unit tests here had missed it.
    expect(first?.title).toBe('Trip 1 Policy number');
    expect(second?.title).toBe('Trip 2 Policy number');
    expect(first?.instanceKey).not.toBe(second?.instanceKey);
  });

  test('a required question inside a hidden group asks nothing', () => {
    const survey = build();

    // The insurance group is hidden until there is a destination, and the question
    // inside it is `visibleIf`-free — so it is visible *itself* while being completely
    // out of reach. Checking it blocks a survey on a field nobody can see, which is the
    // rule a page has always applied and which an instance was getting wrong. The demo
    // found it: the whole survey stopped completing.
    survey.validation.validateCurrentPage();
    expect(survey.getQuestionByName('trips')?.errors ?? []).toEqual([]);
  });

  test('the nested definition round-trips', () => {
    const { survey } = parseSurvey(
      { pages: [{ name: 'p1', elements: [TRIP] }] },
      createTestRegistry(),
    );
    const once = serializeSurvey(survey, createTestRegistry());
    const twice = serializeSurvey(
      parseSurvey(once, createTestRegistry()).survey,
      createTestRegistry(),
    );

    expect(twice).toEqual(once);
  });
});
