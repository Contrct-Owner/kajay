import type { SurveyDefinition } from '@kajay/core';
import { applyPlacement, canPlace, dropSlotsFor } from '@kajay/creator-core';
import type { DropList, PlacementSource, ToolboxItem } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

/** The headless half of drag-and-drop — checklist K2, ADR-0009 constraint 1. */
const TEXT_ITEM: ToolboxItem = {
  name: 'text',
  type: 'text',
  title: 'Single-line input',
  category: 'Text',
  keywords: [],
  defaults: {},
};

const NEW_TEXT: PlacementSource = { kind: 'new', item: TEXT_ITEM };
const P1: DropList = { of: 'elements', container: 'p1' };

function survey(...names: readonly string[]): SurveyDefinition {
  return {
    pages: [{ name: 'p1', elements: names.map((name) => ({ type: 'text', name })) }],
  };
}

function namesOn(definition: SurveyDefinition, page = 0): readonly string[] {
  const pages = definition['pages'] as readonly SurveyDefinition[];
  const elements = pages[page]!['elements'] as readonly SurveyDefinition[];
  return elements.map((element) => element['name'] as string);
}

describe('parity/K2-slots', () => {
  test('n elements offer n + 1 positions', () => {
    // Positions, not neighbours: the list has an end as well as a middle, and a page
    // with nothing on it still has somewhere to drop.
    expect(dropSlotsFor(P1, 2)).toEqual([
      { list: P1, index: 0 },
      { list: P1, index: 1 },
      { list: P1, index: 2 },
    ]);
    expect(dropSlotsFor(P1, 0)).toEqual([{ list: P1, index: 0 }]);
  });
});

describe('parity/K2-placement', () => {
  test('a new element lands where it was dropped', () => {
    const after = applyPlacement(survey('a', 'b'), NEW_TEXT, { list: P1, index: 1 });

    expect(namesOn(after)).toEqual(['a', 'text1', 'b']);
  });

  test('the definition it was given is left alone', () => {
    const before = survey('a');

    applyPlacement(before, NEW_TEXT, { list: P1, index: 0 });

    // K6's undo stack is a stack of these. A placement that edited its input in place
    // would corrupt every entry already on it.
    expect(namesOn(before)).toEqual(['a']);
  });

  test('a new element is named after its type, avoiding what is taken', () => {
    const after = applyPlacement(survey('text1', 'text2'), NEW_TEXT, { list: P1, index: 2 });

    expect(namesOn(after)[2]).toBe('text3');
  });

  test('a name is unique across the survey, not the page', () => {
    const before: SurveyDefinition = {
      pages: [
        { name: 'p1', elements: [] },
        { name: 'p2', elements: [{ type: 'text', name: 'text1' }] },
      ],
    };

    const after = applyPlacement(before, NEW_TEXT, { list: P1, index: 0 });

    // Two pages each holding a `text1` is exactly the collision that makes
    // `getQuestionByName` answer with somebody else's question.
    expect(namesOn(after, 0)).toEqual(['text2']);
  });

  test('a name is avoided wherever it is, including inside a question', () => {
    const before: SurveyDefinition = {
      pages: [
        {
          name: 'p1',
          elements: [{ type: 'matrix', name: 'grid', columns: [{ name: 'text1' }] }],
        },
      ],
    };

    const after = applyPlacement(before, NEW_TEXT, { list: P1, index: 1 });

    // Over-inclusive on purpose: a matrix column is not a question, but nothing is
    // harmed by skipping the name, and a collision costs a survey.
    expect(namesOn(after)[1]).toBe('text2');
  });

  test('the toolbox item decides what the element starts as', () => {
    const item: ToolboxItem = {
      ...TEXT_ITEM,
      name: 'stars',
      type: 'rating',
      defaults: { rateType: 'stars', rateMax: 7 },
    };

    const after = applyPlacement(survey(), { kind: 'new', item }, { list: P1, index: 0 });
    const pages = after['pages'] as readonly SurveyDefinition[];
    const element = (pages[0]!['elements'] as readonly SurveyDefinition[])[0]!;

    // One type, two toolbox items — which is why K1 keys the toolbox by name.
    expect(element).toEqual({ type: 'rating', rateType: 'stars', rateMax: 7, name: 'rating1' });
  });
});

describe('parity/K2-move', () => {
  const moveA: PlacementSource = { kind: 'move', name: 'a' };

  test('moving down accounts for the hole it leaves behind', () => {
    const after = applyPlacement(survey('a', 'b', 'c', 'd'), moveA, { list: P1, index: 3 });

    // The target was measured with `a` still in the list. Not subtracting one here is
    // the classic reorder bug, and it only ever shows up moving in one direction.
    //
    // The landing place is deliberately *not* the end of the list. Moving to the end
    // hides the bug completely — an index past the end and one before it both slice to
    // the same place — and a mutant that dropped the correction survived a test that
    // did exactly that.
    expect(namesOn(after)).toEqual(['b', 'c', 'a', 'd']);
  });

  test('moving down to the very end lands at the very end', () => {
    const after = applyPlacement(survey('a', 'b', 'c'), moveA, { list: P1, index: 3 });

    expect(namesOn(after)).toEqual(['b', 'c', 'a']);
  });

  test('moving up needs no such correction', () => {
    const after = applyPlacement(survey('a', 'b', 'c'), { kind: 'move', name: 'c' }, { list: P1, index: 0 });

    expect(namesOn(after)).toEqual(['c', 'a', 'b']);
  });

  test('the slot it sits in and the one after it are the same position', () => {
    const before = survey('a', 'b');

    // Removing `a` shifts `b` up, so "before a" and "after a" describe one place. A
    // model that told them apart would report an edit, push an undo entry and re-parse
    // the survey, all to arrive back where it started.
    expect(canPlace(before, moveA, { list: P1, index: 0 })).toBe(false);
    expect(canPlace(before, moveA, { list: P1, index: 1 })).toBe(false);
    expect(canPlace(before, moveA, { list: P1, index: 2 })).toBe(true);
  });

  test('a refused placement gives back exactly what it was given', () => {
    const before = survey('a', 'b');

    // Identity, so a caller can tell nothing happened without comparing surveys.
    expect(applyPlacement(before, moveA, { list: P1, index: 0 })).toBe(before);
  });
});

describe('parity/K2-placement-refusals', () => {
  test('a page the survey does not have', () => {
    expect(canPlace(survey('a'), NEW_TEXT, { list: { of: 'elements', container: 'nowhere' }, index: 0 })).toBe(false);
  });

  test('a position off either end of the list', () => {
    expect(canPlace(survey('a'), NEW_TEXT, { list: P1, index: -1 })).toBe(false);
    expect(canPlace(survey('a'), NEW_TEXT, { list: P1, index: 2 })).toBe(false);
    // One past the last element is the end of the list, not off it.
    expect(canPlace(survey('a'), NEW_TEXT, { list: P1, index: 1 })).toBe(true);
  });

  test('an element that is not there', () => {
    expect(
      canPlace(survey('a'), { kind: 'move', name: 'ghost' }, { list: P1, index: 0 }),
    ).toBe(false);
  });

  test('a survey with no pages at all', () => {
    expect(canPlace({}, NEW_TEXT, { list: P1, index: 0 })).toBe(false);
  });

  test('a toolbox item dropped into the page list', () => {
    // The type can say it, so the model has to answer: a toolbox item builds a page
    // *element*, and a survey whose pages were questions is not a survey.
    expect(canPlace(survey('a'), NEW_TEXT, { list: { of: 'pages' }, index: 0 })).toBe(false);
  });
});
