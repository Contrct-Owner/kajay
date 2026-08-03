import { parseSurvey, serializeSurvey } from '@kajay/core';
import type { ChoiceFetcher, SelectQuestion, Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function build(
  definition: Readonly<Record<string, unknown>>,
  fetchJson?: ChoiceFetcher,
): Survey {
  return parseSurvey(
    definition,
    createTestRegistry(),
    fetchJson === undefined ? {} : { fetchJson },
  ).survey;
}

function select(survey: Survey, name: string): SelectQuestion {
  const question = survey.getQuestionByName(name);
  if (question === undefined) {
    throw new TypeError(`no question named ${name}`);
  }
  return question as SelectQuestion;
}

const carryForward = (mode: string): Readonly<Record<string, unknown>> => ({
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'checkbox', name: 'source', choices: ['a', 'b', 'c'] },
        {
          type: 'radiogroup',
          name: 'target',
          choices: ['ignored'],
          choicesFromQuestion: 'source',
          choicesFromQuestionMode: mode,
        },
      ],
    },
  ],
});

describe('parity/B9-carry-forward-choices', () => {
  test('all mode carries every choice from the source', () => {
    const survey = build(carryForward('all'));
    expect(select(survey, 'target').visibleChoices.map((c) => c.value)).toEqual(['a', 'b', 'c']);
  });

  test('selected mode follows the source answer', () => {
    const survey = build(carryForward('selected'));
    expect(select(survey, 'target').visibleChoices).toHaveLength(0);

    survey.setValue('source', ['a', 'c']);
    expect(select(survey, 'target').visibleChoices.map((c) => c.value)).toEqual(['a', 'c']);
  });

  test('unselected mode is the complement', () => {
    const survey = build(carryForward('unselected'));
    survey.setValue('source', ['a', 'c']);
    expect(select(survey, 'target').visibleChoices.map((c) => c.value)).toEqual(['b']);
  });

  test('the list follows later changes to the source answer', () => {
    const survey = build(carryForward('selected'));
    survey.setValue('source', ['a']);
    expect(select(survey, 'target').visibleChoices.map((c) => c.value)).toEqual(['a']);
    survey.setValue('source', ['b', 'c']);
    expect(select(survey, 'target').visibleChoices.map((c) => c.value)).toEqual(['b', 'c']);
  });

  test('a single-select source is treated as a selection of one', () => {
    const survey = build({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'radiogroup', name: 'source', choices: ['a', 'b'] },
            {
              type: 'radiogroup',
              name: 'target',
              choicesFromQuestion: 'source',
              choicesFromQuestionMode: 'selected',
            },
          ],
        },
      ],
    });
    survey.setValue('source', 'b');
    expect(select(survey, 'target').visibleChoices.map((c) => c.value)).toEqual(['b']);
  });

  test('a hidden source choice is not carried forward', () => {
    const survey = build({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'gate' },
            {
              type: 'checkbox',
              name: 'source',
              choices: ['a', { value: 'b', visibleIf: "{gate} == 'yes'" }],
            },
            { type: 'radiogroup', name: 'target', choicesFromQuestion: 'source' },
          ],
        },
      ],
    });

    expect(select(survey, 'target').visibleChoices.map((c) => c.value)).toEqual(['a']);
    survey.setValue('gate', 'yes');
    expect(select(survey, 'target').visibleChoices.map((c) => c.value)).toEqual(['a', 'b']);
  });

  test('pointing at a question with no choices falls back to the authored list', () => {
    const survey = build({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'notASelect' },
            {
              type: 'radiogroup',
              name: 'target',
              choices: ['fallback'],
              choicesFromQuestion: 'notASelect',
            },
          ],
        },
      ],
    });
    expect(select(survey, 'target').visibleChoices.map((c) => c.value)).toEqual(['fallback']);
  });

  test('the authored list still serializes, whatever is carried forward', () => {
    const registry = createTestRegistry();
    const survey = parseSurvey(carryForward('all'), registry).survey;
    const canonical = serializeSurvey(survey, registry);
    const serialized = JSON.stringify(canonical);

    expect(serialized).toContain('"choicesFromQuestion":"source"');
    // The carried list is runtime state, never definition.
    expect(serialized).toContain('{"value":"ignored"}');
  });
});

describe('choice sources and the renderer contract', () => {
  test('a changed list is announced through the element-state event', () => {
    const survey = build(carryForward('selected'));
    const seen: string[] = [];
    survey.onElementStateChanged.add((event) => seen.push(event.state));

    survey.setValue('source', ['a']);
    expect(seen).toContain('choices');
  });

  test('logicVersion advances so a renderer re-reads the list', () => {
    const survey = build(carryForward('selected'));
    const before = survey.logicVersion;
    survey.setValue('source', ['a']);
    expect(survey.logicVersion).toBeGreaterThan(before);
  });

  test('carry-forward wins when both sources are declared', () => {
    const survey = build({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'checkbox', name: 'source', choices: ['a'] },
            {
              type: 'radiogroup',
              name: 'target',
              choicesFromQuestion: 'source',
              choicesByUrl: 'https://example.test/never-called',
            },
          ],
        },
      ],
    });
    // No fetcher was supplied, and no error was reported, so the URL was never used.
    expect(survey.choiceErrors).toEqual([]);
    expect(select(survey, 'target').visibleChoices.map((c) => c.value)).toEqual(['a']);
  });
});
