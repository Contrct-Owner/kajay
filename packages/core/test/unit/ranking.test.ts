import { RankingQuestion, parseSurvey } from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';
import { moveWithin } from '../../src/model/moveWithin.js';

function ranking(extra: Readonly<Record<string, unknown>> = {}): RankingQuestion {
  const survey: Survey = parseSurvey(
    {
      pages: [
        {
          name: 'p1',
          elements: [
            {
              type: 'ranking',
              name: 'priorities',
              choices: [
                { value: 'speed', text: 'Speed' },
                { value: 'price', text: 'Price' },
                { value: 'support', text: 'Support' },
              ],
              ...extra,
            },
          ],
        },
      ],
    },
    createTestRegistry(),
  ).survey;
  const question = survey.getQuestionByName('priorities');
  if (!(question instanceof RankingQuestion)) {
    throw new TypeError('expected a ranking');
  }
  return question;
}

function texts(choices: readonly { text: string }[]): readonly string[] {
  return choices.map((choice) => choice.text);
}

describe('parity/C9-reorder-primitive', () => {
  test('an entry lands at the index it was asked for, in the result', () => {
    // The index a respondent points at is a position in the list they can see, not a
    // position in the list minus the row travelling across it.
    expect(moveWithin(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveWithin(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  test('a move that changes nothing returns the same list', () => {
    const items = ['a', 'b', 'c'];
    // Identity, so a caller can skip announcing a move that did not happen.
    expect(moveWithin(items, 1, 1)).toBe(items);
    expect(moveWithin(items, -1, 0)).toBe(items);
    expect(moveWithin(items, 0, 3)).toBe(items);
    expect(moveWithin(items, 0.5, 1)).toBe(items);
  });

  test('the source list is never mutated', () => {
    const items = ['a', 'b', 'c'];
    moveWithin(items, 0, 2);
    expect(items).toEqual(['a', 'b', 'c']);
  });
});

describe('parity/C9-ranking', () => {
  test('every choice is ranked, in the authored order, before anything is moved', () => {
    const question = ranking();
    expect(texts(question.rankedChoices)).toEqual(['Speed', 'Price', 'Support']);
    expect(question.unrankedChoices).toEqual([]);
  });

  test('an untouched ranking has recorded no answer', () => {
    // The order on screen is the author's, not the respondent's. Recording it as an
    // answer would put an opinion in the data that nobody expressed — so a required
    // ranking still demands that someone actually rank it.
    const question = ranking({ isRequired: true });
    expect(question.value).toBeUndefined();
  });

  test('moving a row records the whole order, best first', () => {
    const question = ranking();
    expect(question.moveRanked(2, 0)).toBe(true);

    expect(question.value).toEqual(['support', 'speed', 'price']);
    expect(question.rankOf('support')).toBe(1);
    expect(question.rankOf('price')).toBe(3);
  });

  test('a move that goes nowhere is reported as such and writes nothing', () => {
    const question = ranking();
    expect(question.moveRanked(1, 1)).toBe(false);
    expect(question.moveRanked(0, 9)).toBe(false);
    expect(question.value).toBeUndefined();
  });

  test('a choice that stops being offered loses its position and gets it back', () => {
    const survey: Survey = parseSurvey(
      {
        pages: [
          {
            name: 'p1',
            elements: [
              { type: 'boolean', name: 'showPrice' },
              {
                type: 'ranking',
                name: 'priorities',
                choices: [
                  { value: 'speed', text: 'Speed' },
                  { value: 'price', text: 'Price', visibleIf: '{showPrice} = true' },
                  { value: 'support', text: 'Support' },
                ],
              },
            ],
          },
        ],
      },
      createTestRegistry(),
    ).survey;
    const question = survey.getQuestionByName('priorities');
    if (!(question instanceof RankingQuestion)) {
      throw new TypeError('expected a ranking');
    }

    // A response restored from storage, ranked while Price was on offer.
    survey.setValue('priorities', ['price', 'support', 'speed']);
    // It cannot hold first place in a list it is not in.
    expect(texts(question.rankedChoices)).toEqual(['Support', 'Speed']);

    survey.setValue('showPrice', true);
    // And the stored answer was never rewritten, so its position comes back with it —
    // hiding a choice must not silently promote everything under it for good.
    expect(texts(question.rankedChoices)).toEqual(['Price', 'Support', 'Speed']);
  });

  test('an order naming an unknown choice, or naming one twice, is not a ranking', () => {
    const question = ranking();
    question.applySelection(['support', 'nonsense', 'support', 'speed']);

    expect(question.value).toEqual(['support', 'speed']);
    // Price was never ranked, so it sits where the author left it — last.
    expect(texts(question.rankedChoices)).toEqual(['Support', 'Speed', 'Price']);
  });

  test('none and other are not positions in a list', () => {
    const question = ranking({ showNoneItem: true, showOtherItem: true });
    expect(texts(question.rankedChoices)).toEqual(['Speed', 'Price', 'Support']);
  });

  test('the authored none and other still round-trip', () => {
    // Ignored at the model level, not dropped from the definition: serialization reads
    // the property bag, so what the author wrote comes back out (ADR-0002).
    const question = ranking({ showNoneItem: true });
    expect(question.showNoneItem).toBe(false);
    expect(question.getPropertyValue('showNoneItem')).toBe(true);
  });
});

describe('parity/C9-select-to-rank', () => {
  function pool(extra: Readonly<Record<string, unknown>> = {}): RankingQuestion {
    return ranking({ selectToRankEnabled: true, ...extra });
  }

  test('nothing is ranked until it is placed', () => {
    const question = pool();
    expect(question.rankedChoices).toEqual([]);
    expect(texts(question.unrankedChoices)).toEqual(['Speed', 'Price', 'Support']);
  });

  test('placing a choice moves it out of the pool and onto the end', () => {
    const question = pool();
    question.select('support');
    question.select('speed');

    expect(question.value).toEqual(['support', 'speed']);
    expect(texts(question.unrankedChoices)).toEqual(['Price']);
  });

  test('a placed choice goes back to the pool, and everything below it moves up', () => {
    const question = pool();
    question.applySelection(['speed', 'price', 'support']);
    question.select('price');

    expect(question.value).toEqual(['speed', 'support']);
    expect(question.rankOf('support')).toBe(2);
    expect(texts(question.unrankedChoices)).toEqual(['Price']);
  });

  test('the pool keeps its display order however things leave and return', () => {
    const question = pool();
    question.select('price');
    question.unrank('price');
    expect(texts(question.unrankedChoices)).toEqual(['Speed', 'Price', 'Support']);
  });

  test('a full ranking refuses another rather than dropping an earlier choice', () => {
    const question = pool({ maxSelectedChoices: 2 });
    question.select('speed');
    question.select('price');
    question.select('support');

    expect(question.value).toEqual(['speed', 'price']);
    expect(question.rankOf('support')).toBe(0);
  });

  test('the limit holds however the order arrived', () => {
    const question = pool({ maxSelectedChoices: 2 });
    question.applySelection(['support', 'speed', 'price']);
    expect(question.value).toEqual(['support', 'speed']);
  });

  test('emptying the ranking is no answer at all', () => {
    const question = pool();
    question.select('speed');
    question.unrank('speed');
    // Not `[]`: `isRequired` and every `notempty` in an expression have to agree about
    // what an unanswered ranking looks like.
    expect(question.value).toBeUndefined();
  });

  test('a choice can be placed at a position rather than at the end', () => {
    const question = pool();
    question.rank('speed');
    question.rank('support', 0);
    expect(question.value).toEqual(['support', 'speed']);
  });

  test('placing what is already placed, or what is not offered, changes nothing', () => {
    const question = pool();
    question.rank('speed');
    question.rank('speed');
    question.rank('nonsense');
    expect(question.value).toEqual(['speed']);
  });

  test('the pool only exists in this mode', () => {
    const plain = ranking();
    plain.unrank('speed');
    plain.rank('speed', 0);
    // Every choice is already ranked, so there is nowhere for one to go and nothing
    // for a click to mean.
    expect(plain.value).toBeUndefined();
    expect(plain.unrankedChoices).toEqual([]);
  });

  test('the layout of the two areas is authored, and vertical unless it says otherwise', () => {
    expect(pool().selectToRankAreasLayout).toBe('vertical');
    expect(pool({ selectToRankAreasLayout: 'horizontal' }).selectToRankAreasLayout).toBe(
      'horizontal',
    );
    expect(pool({ selectToRankAreasLayout: 'sideways' }).selectToRankAreasLayout).toBe('vertical');
  });
});
