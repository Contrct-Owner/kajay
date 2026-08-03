import { parseSurvey, serializeSurvey } from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function build(
  triggers: readonly Readonly<Record<string, unknown>>[],
  elements: readonly Readonly<Record<string, unknown>>[] = [
    { type: 'text', name: 'gate' },
    { type: 'text', name: 'target' },
    { type: 'text', name: 'source' },
  ],
): Survey {
  return parseSurvey(
    { triggers, pages: [{ name: 'p1', elements }] },
    createTestRegistry(),
  ).survey;
}

describe('parity/B7-trigger-complete', () => {
  test('completes the survey when its condition becomes true', () => {
    const survey = build([{ type: 'complete', expression: "{gate} == 'done'" }]);
    expect(survey.isCompleted).toBe(false);
    survey.setValue('gate', 'done');
    expect(survey.isCompleted).toBe(true);
  });

  test('does not fire on load when the condition is already true', () => {
    // Firing here would complete a survey before the respondent ever saw it.
    const survey = parseSurvey(
      {
        triggers: [{ type: 'complete', expression: 'true' }],
        pages: [{ name: 'p1', elements: [{ type: 'text', name: 'q' }] }],
      },
      createTestRegistry(),
    ).survey;
    expect(survey.isCompleted).toBe(false);
  });
});

describe('parity/B7-trigger-setvalue', () => {
  test('writes a literal when the condition becomes true', () => {
    const survey = build([
      { type: 'setvalue', expression: '{gate} notempty', setToName: 'target', setValue: 'written' },
    ]);
    survey.setValue('gate', 'x');
    expect(survey.getValue('target')).toBe('written');
  });

  test('a literal may be a number or a boolean, not only a string', () => {
    const survey = build([
      { type: 'setvalue', expression: '{gate} == 1', setToName: 'target', setValue: 42 },
      { type: 'setvalue', expression: '{gate} == 2', setToName: 'source', setValue: true },
    ]);
    survey.setValue('gate', 1);
    expect(survey.getValue('target')).toBe(42);
    survey.setValue('gate', 2);
    expect(survey.getValue('source')).toBe(true);
  });

  test('fires on the transition only, so a later edit is not overwritten', () => {
    const survey = build([
      { type: 'setvalue', expression: '{gate} notempty', setToName: 'target', setValue: 'written' },
    ]);
    survey.setValue('gate', 'x');
    survey.setValue('target', 'typed by hand');
    // The condition is still true, but it did not *become* true again.
    survey.setValue('gate', 'y');
    expect(survey.getValue('target')).toBe('typed by hand');
  });

  test('fires again after the condition goes false and true once more', () => {
    const survey = build([
      { type: 'setvalue', expression: '{gate} notempty', setToName: 'target', setValue: 'written' },
    ]);
    survey.setValue('gate', 'x');
    survey.setValue('target', 'typed by hand');
    survey.setValue('gate', '');
    survey.setValue('gate', 'again');
    expect(survey.getValue('target')).toBe('written');
  });
});

describe('parity/B7-trigger-copyvalue', () => {
  test('copies one answer into another', () => {
    const survey = build([
      { type: 'copyvalue', expression: '{gate} notempty', setToName: 'target', fromName: 'source' },
    ]);
    survey.setValue('source', 'copied');
    survey.setValue('gate', 'go');
    expect(survey.getValue('target')).toBe('copied');
  });

  test('copies the value as it stands when the trigger fires', () => {
    const survey = build([
      { type: 'copyvalue', expression: '{gate} notempty', setToName: 'target', fromName: 'source' },
    ]);
    survey.setValue('source', 'first');
    survey.setValue('gate', 'go');
    // A trigger is an event, not a binding: later edits to the source do not follow.
    survey.setValue('source', 'second');
    expect(survey.getValue('target')).toBe('first');
  });
});

describe('parity/B7-trigger-runexpression', () => {
  test('stores the result of an expression', () => {
    const survey = build([
      {
        type: 'runexpression',
        expression: '{gate} notempty',
        runExpression: '{a} + {b}',
        setToName: 'target',
      },
      { type: 'text', name: 'a' },
    ]);
    survey.setValue('a', 2);
    survey.setValue('b', 3);
    survey.setValue('gate', 'go');
    expect(survey.getValue('target')).toBe(5);
  });

  test('runs without storing when no target is named', () => {
    const survey = build([
      { type: 'runexpression', expression: '{gate} notempty', runExpression: '1 + 1' },
    ]);
    expect(() => survey.setValue('gate', 'go')).not.toThrow();
    expect(survey.getValue('target')).toBeUndefined();
  });
});

describe('parity/B7-trigger-skip', () => {
  const twoPages = {
    triggers: [{ type: 'skip', expression: "{gate} == 'skip'", gotoName: 'p2' }],
    pages: [
      { name: 'p1', elements: [{ type: 'text', name: 'gate' }] },
      { name: 'p2', elements: [{ type: 'text', name: 'later' }] },
    ],
  };

  test('navigates to a page by name', () => {
    const survey = parseSurvey(twoPages, createTestRegistry()).survey;
    expect(survey.currentPageNo).toBe(0);
    survey.setValue('gate', 'skip');
    expect(survey.currentPage?.name).toBe('p2');
  });

  test('navigates to the page owning a named question', () => {
    const survey = parseSurvey(
      {
        triggers: [{ type: 'skip', expression: "{gate} == 'skip'", gotoName: 'later' }],
        pages: twoPages.pages,
      },
      createTestRegistry(),
    ).survey;
    survey.setValue('gate', 'skip');
    expect(survey.currentPage?.name).toBe('p2');
  });

  test('an unknown target leaves navigation alone', () => {
    const survey = parseSurvey(
      {
        triggers: [{ type: 'skip', expression: '{gate} notempty', gotoName: 'nowhere' }],
        pages: twoPages.pages,
      },
      createTestRegistry(),
    ).survey;
    survey.setValue('gate', 'x');
    expect(survey.currentPageNo).toBe(0);
  });
});

describe('triggers and the rest of the engine', () => {
  test('a trigger-written value drives logic downstream of it', () => {
    const survey = build(
      [{ type: 'setvalue', expression: '{gate} notempty', setToName: 'target', setValue: 99 }],
      [
        { type: 'text', name: 'gate' },
        { type: 'text', name: 'target' },
        { type: 'text', name: 'warning', visibleIf: '{target} > 50' },
      ],
    );
    expect(survey.getQuestionByName('warning')?.isVisible).toBe(false);
    survey.setValue('gate', 'x');
    expect(survey.getQuestionByName('warning')?.isVisible).toBe(true);
  });

  test('a malformed condition never fires', () => {
    const survey = build([
      { type: 'setvalue', expression: '{gate} ===', setToName: 'target', setValue: 'nope' },
    ]);
    survey.setValue('gate', 'x');
    expect(survey.getValue('target')).toBeUndefined();
  });

  test('several triggers on one condition all fire', () => {
    const survey = build([
      { type: 'setvalue', expression: '{gate} notempty', setToName: 'target', setValue: 'a' },
      { type: 'setvalue', expression: '{gate} notempty', setToName: 'source', setValue: 'b' },
    ]);
    survey.setValue('gate', 'x');
    expect([survey.getValue('target'), survey.getValue('source')]).toEqual(['a', 'b']);
  });
});

describe('triggers and serialization', () => {
  test('round-trip is a fixed point and keeps each kind distinct', () => {
    const registry = createTestRegistry();
    const definition = {
      triggers: [
        { type: 'complete', expression: '{a} == 1' },
        { type: 'setvalue', expression: '{a} == 2', setToName: 'b', setValue: 7 },
        { type: 'copyvalue', expression: '{a} == 3', setToName: 'b', fromName: 'c' },
        { type: 'runexpression', expression: '{a} == 4', runExpression: '{a} * 2', setToName: 'b' },
        { type: 'skip', expression: '{a} == 5', gotoName: 'p1' },
      ],
      pages: [{ name: 'p1', elements: [{ type: 'text', name: 'a' }] }],
    };

    const canonical = serializeSurvey(parseSurvey(definition, registry).survey, registry);
    const second = serializeSurvey(parseSurvey(canonical, registry).survey, registry);
    expect(JSON.stringify(second)).toBe(JSON.stringify(canonical));

    const triggers = canonical['triggers'] as Record<string, unknown>[];
    expect(triggers.map((trigger) => trigger['type'])).toEqual([
      'complete',
      'setvalue',
      'copyvalue',
      'runexpression',
      'skip',
    ]);
    // The literal keeps its authored type rather than being coerced to text.
    expect(triggers[1]?.['setValue']).toBe(7);
  });

  test('a trigger kind that is not registered is reported', () => {
    const { diagnostics } = parseSurvey(
      { triggers: [{ type: 'teleport', expression: 'true' }] },
      createTestRegistry(),
    );
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain('unknown-element-type');
  });
});
