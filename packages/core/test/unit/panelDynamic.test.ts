import { PanelDynamicQuestion, parseSurvey, serializeSurvey } from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

const PEOPLE = {
  type: 'paneldynamic',
  name: 'people',
  title: 'Who is travelling?',
  panelTitleFormat: 'Traveller {0}',
  templateElements: [
    { type: 'text', name: 'fullName', title: 'Name', isRequired: true },
    { type: 'text', name: 'age', title: 'Age', inputType: 'number' },
    {
      // Asked of this traveller only, about this traveller's own answer.
      type: 'text',
      name: 'guardian',
      title: 'Who is responsible for them?',
      visibleIf: '{panel.age} < 18',
      isRequired: true,
    },
  ],
};

function build(overrides: Readonly<Record<string, unknown>> = {}): Survey {
  return parseSurvey(
    { pages: [{ name: 'p1', elements: [{ ...PEOPLE, ...overrides }] }] },
    createTestRegistry(),
  ).survey;
}

function panels(survey: Survey): PanelDynamicQuestion {
  const question = survey.getQuestionByName('people');
  if (!(question instanceof PanelDynamicQuestion)) {
    throw new TypeError('expected a dynamic panel');
  }
  return question;
}

function answer(survey: Survey, index: string, name: string, value: unknown): void {
  const cell = panels(survey).cellAt(index, name);
  if (cell === undefined) {
    throw new Error(`no question ${index}.${name}`);
  }
  cell.value = value;
}

function errorsOf(survey: Survey): readonly string[] {
  survey.validation.validateCurrentPage();
  return (survey.getQuestionByName('people')?.errors ?? []).map(
    (error) => `${error.path ?? '(question)'}: ${error.text}`,
  );
}

describe('parity/G1-paneldynamic', () => {
  test('the instances are the answer: an array of records', () => {
    const survey = build();
    answer(survey, '0', 'fullName', 'Ada');

    expect(survey.data).toEqual({ people: [{ fullName: 'Ada' }] });
  });

  test('adding an instance keeps it before anything is typed into it', () => {
    const survey = build();
    panels(survey).addPanel();
    answer(survey, '1', 'fullName', 'Grace');

    expect(panels(survey).panelCount).toBe(2);
    expect(survey.data).toEqual({ people: [{}, { fullName: 'Grace' }] });
  });

  test('a removed instance takes its answers with it and the rest move up', () => {
    const survey = build();
    answer(survey, '0', 'fullName', 'Ada');
    panels(survey).addPanel();
    answer(survey, '1', 'fullName', 'Grace');

    panels(survey).removePanel('0');

    expect(survey.data).toEqual({ people: [{ fullName: 'Grace' }] });
    expect(panels(survey).cellAt('0', 'fullName')?.value).toBe('Grace');
  });

  test('min and max bound what the respondent may do', () => {
    const survey = build({ minPanelCount: 2, maxPanelCount: 3 });
    expect(panels(survey).panelCount).toBe(2);
    expect(panels(survey).canRemovePanel).toBe(false);

    panels(survey).addPanel();
    expect(panels(survey).canAddPanel).toBe(false);
    expect(panels(survey).canRemovePanel).toBe(true);
  });

  test('an untouched panel is no answer at all', () => {
    const survey = build({ minPanelCount: 2 });

    // The minimum is a statement about the form, not about what anybody has said.
    expect(panels(survey).panelCount).toBe(2);
    expect(survey.data).toEqual({});
  });

  test('the instance count survives a save and resume', () => {
    const survey = build();
    panels(survey).addPanel();
    answer(survey, '1', 'fullName', 'Grace');

    const resumed = build();
    resumed.restore(survey.progress);

    expect(panels(resumed).panelCount).toBe(2);
    expect(panels(resumed).cellAt('1', 'fullName')?.value).toBe('Grace');
  });

  test('every instance is checked, and a message names the one it belongs to', () => {
    const survey = build();
    panels(survey).addPanel();
    answer(survey, '0', 'fullName', 'Ada');

    expect(errorsOf(survey)).toEqual(['1.fullName: This question requires an answer.']);
  });

  test('the definition round-trips and holds no instance state', () => {
    const survey = build();
    panels(survey).addPanel();

    const once = serializeSurvey(survey, createTestRegistry());
    const twice = serializeSurvey(
      parseSurvey(once, createTestRegistry()).survey,
      createTestRegistry(),
    );

    expect(twice).toEqual(once);
    expect(JSON.stringify(once)).not.toContain('currentIndex');
  });
});

describe('parity/G3-panel-scope', () => {
  test('{panel.q} is this instance, and no other', () => {
    const survey = build();
    panels(survey).addPanel();
    answer(survey, '1', 'age', 12);

    // The same mechanism a matrix cell uses, under the word that reads better here:
    // the template's `{panel.age}` became `{people[1].age}` when the instance was built.
    expect(panels(survey).cellAt('1', 'guardian')?.isVisible).toBe(true);
    expect(panels(survey).cellAt('0', 'guardian')?.isVisible).toBe(false);
  });

  test('a hidden question inside an instance is not checked', () => {
    const survey = build();
    answer(survey, '0', 'fullName', 'Ada');
    answer(survey, '0', 'age', 40);

    expect(errorsOf(survey)).toEqual([]);

    answer(survey, '0', 'age', 12);
    expect(errorsOf(survey)).toEqual(['0.guardian: This question requires an answer.']);
  });

  test('a computed question inside an instance computes from it', () => {
    const survey = build({
      templateElements: [
        { type: 'text', name: 'unit', inputType: 'number' },
        { type: 'text', name: 'nights', inputType: 'number' },
        { type: 'expression', name: 'cost', expression: '{panel.unit} * {panel.nights}' },
      ],
    });
    answer(survey, '0', 'unit', 90);
    answer(survey, '0', 'nights', 3);

    expect(panels(survey).cellAt('0', 'cost')?.value).toBe(270);
  });

  test('an expression outside reaches into an instance by index', () => {
    const survey = parseSurvey(
      {
        pages: [
          {
            name: 'p1',
            elements: [
              PEOPLE,
              { type: 'text', name: 'first', defaultValueExpression: '{people[0].fullName}' },
            ],
          },
        ],
      },
      createTestRegistry(),
    ).survey;
    answer(survey, '0', 'fullName', 'Ada');

    expect(survey.data['first']).toBe('Ada');
  });
});

describe('parity/G3-value-name', () => {
  test('two questions sharing a valueName share an answer', () => {
    const survey = parseSurvey(
      {
        pages: [
          {
            name: 'p1',
            elements: [
              { type: 'text', name: 'homeEmail', valueName: 'email' },
              { type: 'text', name: 'workEmail', valueName: 'email' },
            ],
          },
        ],
      },
      createTestRegistry(),
    ).survey;

    const home = survey.getQuestionByName('homeEmail');
    const work = survey.getQuestionByName('workEmail');
    if (home === undefined || work === undefined) {
      throw new Error('expected both questions');
    }
    home.value = 'ada@example.com';

    // One field in the response, under the shared key — and identity is still the name,
    // so each question is found, addressed and validated as itself.
    expect(work.value).toBe('ada@example.com');
    expect(survey.data).toEqual({ email: 'ada@example.com' });
  });

  test('a question with no valueName is stored under its own name', () => {
    const survey = build();
    answer(survey, '0', 'fullName', 'Ada');

    expect(survey.data).toEqual({ people: [{ fullName: 'Ada' }] });
  });
});

describe('parity/G2-render-modes', () => {
  test('list shows every instance at once', () => {
    const survey = build({ minPanelCount: 2 });
    expect(panels(survey).visiblePanelKeys).toEqual(['0', '1']);
  });

  test('a paged mode shows the one being looked at', () => {
    const survey = build({ renderMode: 'tab', minPanelCount: 3 });
    expect(panels(survey).visiblePanelKeys).toEqual(['0']);

    panels(survey).setCurrentIndex(2);
    expect(panels(survey).visiblePanelKeys).toEqual(['2']);
  });

  test('adding moves to what was added', () => {
    const survey = build({ renderMode: 'progress' });
    panels(survey).addPanel();

    // A control that adds something the respondent then has to go and find is a control
    // that appears to do nothing.
    expect(panels(survey).currentIndex).toBe(1);
    expect(panels(survey).visiblePanelKeys).toEqual(['1']);
  });

  test('the position is clamped when instances go away underneath it', () => {
    const survey = build({ renderMode: 'tab' });
    panels(survey).addPanel();
    panels(survey).addPanel();
    panels(survey).setCurrentIndex(2);

    panels(survey).removePanel('2');

    expect(panels(survey).currentIndex).toBe(1);
    expect(panels(survey).visiblePanelKeys).toEqual(['1']);
  });

  test('the position is clamped when a host rewrites the answer underneath it', () => {
    const survey = build({ renderMode: 'tab' });
    panels(survey).addPanel();
    panels(survey).addPanel();
    panels(survey).setCurrentIndex(2);

    // Nothing went through `removePanel`: a host restoring a shorter response, or
    // writing `data` directly, moves the ground under a stored index. Clamping on
    // *read* is what covers that — clamping only where instances are removed leaves an
    // empty panel on screen until something happens to correct it.
    survey.setValue('people', [{ fullName: 'Ada' }]);

    expect(panels(survey).currentIndex).toBe(0);
    expect(panels(survey).visiblePanelKeys).toEqual(['0']);
  });
});
