import { parseSurvey, serializeSurvey } from '@kajay/core';
import type { ElementStateChangedEvent, Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function build(definition: Readonly<Record<string, unknown>>): Survey {
  return parseSurvey(definition, createTestRegistry()).survey;
}

function twoQuestions(visibleIf: string): Readonly<Record<string, unknown>> {
  return {
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'text', name: 'trigger' },
          { type: 'text', name: 'dependent', visibleIf },
        ],
      },
    ],
  };
}

describe('parity/B3-visible-if', () => {
  test('an element with no condition is visible', () => {
    const survey = build({ pages: [{ name: 'p1', elements: [{ type: 'text', name: 'q' }] }] });
    expect(survey.getQuestionByName('q')?.isVisible).toBe(true);
  });

  test('a condition is evaluated on load, before anything renders', () => {
    const survey = build(twoQuestions("{trigger} == 'yes'"));
    expect(survey.getQuestionByName('dependent')?.isVisible).toBe(false);
    expect(survey.pages[0]?.visibleElements.map((q) => q.name)).toEqual(['trigger']);
  });

  test('answering makes a hidden question appear', () => {
    const survey = build(twoQuestions("{trigger} == 'yes'"));
    survey.setValue('trigger', 'yes');
    expect(survey.getQuestionByName('dependent')?.isVisible).toBe(true);
    expect(survey.pages[0]?.visibleElements.map((q) => q.name)).toEqual(['trigger', 'dependent']);
  });

  test('changing the answer back hides it again', () => {
    const survey = build(twoQuestions("{trigger} == 'yes'"));
    survey.setValue('trigger', 'yes');
    survey.setValue('trigger', 'no');
    expect(survey.getQuestionByName('dependent')?.isVisible).toBe(false);
  });

  test('visibleIf works on a page', () => {
    const survey = build({
      pages: [
        { name: 'p1', elements: [{ type: 'text', name: 'gate' }] },
        { name: 'p2', visibleIf: '{gate} notempty', elements: [{ type: 'text', name: 'later' }] },
      ],
    });

    expect(survey.visiblePages.map((page) => page.name)).toEqual(['p1']);
    survey.setValue('gate', 'x');
    expect(survey.visiblePages.map((page) => page.name)).toEqual(['p1', 'p2']);
  });

  test('the whole expression language is available to a condition', () => {
    const survey = build({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'age' },
            { type: 'text', name: 'country' },
            {
              type: 'text',
              name: 'guardian',
              visibleIf: "{age} < 18 and {country} anyof ['uk', 'us']",
            },
          ],
        },
      ],
    });

    survey.setValue('age', 15);
    expect(survey.getQuestionByName('guardian')?.isVisible).toBe(false);
    survey.setValue('country', 'uk');
    expect(survey.getQuestionByName('guardian')?.isVisible).toBe(true);
    survey.setValue('age', 30);
    expect(survey.getQuestionByName('guardian')?.isVisible).toBe(false);
  });
});

describe('visibility events', () => {
  test('a change emits once, after the model has settled', () => {
    const survey = build(twoQuestions('{trigger} notempty'));
    const seen: ElementStateChangedEvent[] = [];
    survey.onElementStateChanged.add((event) => seen.push(event));

    survey.setValue('trigger', 'x');

    expect(seen).toHaveLength(1);
    const [event] = seen;
    expect(event?.state).toBe('visible');
    expect(event !== undefined && 'value' in event ? event.value : undefined).toBe(true);
    // The listener observes a settled model, not a half-applied one.
    expect(seen[0]?.element.isVisible).toBe(true);
  });

  test('onValueChanged listeners already see the settled visibility', () => {
    const survey = build(twoQuestions('{trigger} notempty'));
    let visibleDuringValueEvent: boolean | undefined;
    survey.onValueChanged.add(() => {
      visibleDuringValueEvent = survey.getQuestionByName('dependent')?.isVisible;
    });

    survey.setValue('trigger', 'x');
    expect(visibleDuringValueEvent).toBe(true);
  });

  test('no event fires when visibility did not actually change', () => {
    const survey = build(twoQuestions('{trigger} notempty'));
    survey.setValue('trigger', 'a');
    let count = 0;
    survey.onElementStateChanged.add(() => {
      count += 1;
    });
    survey.setValue('trigger', 'b');
    expect(count).toBe(0);
  });

  test('logicVersion advances only when a computed state changes', () => {
    const survey = build(twoQuestions('{trigger} notempty'));
    const initial = survey.logicVersion;
    survey.setValue('unrelated', 'x');
    expect(survey.logicVersion).toBe(initial);
    survey.setValue('trigger', 'x');
    expect(survey.logicVersion).toBeGreaterThan(initial);
  });
});

describe('malformed conditions', () => {
  test('a broken expression leaves the element visible rather than hiding it', () => {
    const survey = build(twoQuestions('{trigger} ==='));
    expect(survey.getQuestionByName('dependent')?.isVisible).toBe(true);
    survey.setValue('trigger', 'anything');
    expect(survey.getQuestionByName('dependent')?.isVisible).toBe(true);
  });

  test('an unknown function leaves the element visible', () => {
    const survey = build(twoQuestions('notARegisteredFunction({trigger})'));
    expect(survey.getQuestionByName('dependent')?.isVisible).toBe(true);
  });

  test('a condition referencing a question that does not exist is simply false', () => {
    const survey = build(twoQuestions("{noSuchQuestion} == 'yes'"));
    expect(survey.getQuestionByName('dependent')?.isVisible).toBe(false);
  });
});

describe('visibleIf and serialization', () => {
  test('the rule round-trips; the computed answer is never written', () => {
    const registry = createTestRegistry();
    const definition = twoQuestions('{trigger} notempty');
    const survey = parseSurvey(definition, registry).survey;
    survey.setValue('trigger', 'x');

    const canonical = serializeSurvey(survey, registry);
    const serialized = JSON.stringify(canonical);

    expect(serialized).toContain('"visibleIf":"{trigger} notempty"');
    expect(serialized).not.toContain('isVisible');
  });

  test('refreshLogic is idempotent', () => {
    const survey = build(twoQuestions('{trigger} notempty'));
    survey.setValue('trigger', 'x');
    survey.refreshLogic();
    expect(survey.getQuestionByName('dependent')?.isVisible).toBe(true);
    survey.refreshLogic();
    expect(survey.getQuestionByName('dependent')?.isVisible).toBe(true);
  });
});
