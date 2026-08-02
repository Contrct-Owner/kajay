import { ImagePickerQuestion, parseSurvey } from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function picker(extra: Readonly<Record<string, unknown>> = {}): ImagePickerQuestion {
  const survey: Survey = parseSurvey(
    {
      pages: [
        {
          name: 'p1',
          elements: [
            {
              type: 'imagepicker',
              name: 'q',
              choices: [
                { value: 'cat', text: 'Cat', imageLink: 'cat.png' },
                { value: 'dog', text: 'Dog', imageLink: 'dog.png' },
                { value: 'fox', text: 'Fox', imageLink: 'fox.png' },
              ],
              ...extra,
            },
          ],
        },
      ],
    },
    createTestRegistry(),
  ).survey;
  const question = survey.getQuestionByName('q');
  if (!(question instanceof ImagePickerQuestion)) {
    throw new TypeError('expected an imagepicker');
  }
  return question;
}

describe('parity/C10-imagepicker', () => {
  test('single is the default, and picking replaces rather than adds', () => {
    const question = picker();
    expect(question.multiSelect).toBe(false);

    question.select('cat');
    expect(question.value).toBe('cat');
    question.select('dog');
    expect(question.value).toBe('dog');
  });

  test('picking the chosen tile again clears it, exactly as a radiogroup does', () => {
    const question = picker();
    question.select('cat');
    question.select('cat');
    expect(question.value).toBeUndefined();
  });

  test('multiSelect switches arity without changing the question', () => {
    const question = picker({ multiSelect: true });
    question.select('cat');
    question.select('dog');

    // Same type, same name, same choices — the arity is a property, which is why this
    // is the one select type that cannot pick its semantics from a base class.
    expect(question.value).toEqual(['cat', 'dog']);
  });

  test('the multi-select invariants come with it, not just the array', () => {
    const question = picker({ multiSelect: true, maxSelectedChoices: 2 });
    question.select('cat');
    question.select('dog');
    question.select('fox');

    // Silently refusing the third beats replacing one the respondent chose — the rule
    // is inherited, not reimplemented.
    expect(question.value).toEqual(['cat', 'dog']);
  });

  test('an adapter reporting a whole selection is held to the same rules', () => {
    const single = picker();
    single.applySelection(['cat', 'dog']);
    expect(single.value).toBe('cat');

    const multiple = picker({ multiSelect: true });
    multiple.applySelection(['cat', 'dog']);
    expect(multiple.value).toEqual(['cat', 'dog']);
  });

  test('a choice carries its own picture, and one without still offers itself', () => {
    const question = picker({
      choices: ['plain', { value: 'cat', text: 'Cat', imageLink: 'cat.png' }],
    });
    const [plain, cat] = question.visibleChoices;

    // `none`/`other` and a bare choice have no picture. Rendering them as text tiles
    // beats a broken image or an option that quietly disappears.
    expect(plain?.imageLink).toBe('');
    expect(cat?.imageLink).toBe('cat.png');
  });

  test('a choice visibleIf still governs a tile', () => {
    const question = picker({
      choices: [
        { value: 'cat', text: 'Cat' },
        { value: 'secret', text: 'Secret', visibleIf: '{q} == "cat"' },
      ],
    });
    expect(question.visibleChoices.map((choice) => choice.value)).toEqual(['cat']);
  });

  test('the picture box has defaults, and the label is off but never absent', () => {
    const question = picker();
    expect([question.imageWidth, question.imageHeight]).toEqual([200, 150]);
    expect(question.imageFit).toBe('contain');
    expect(question.contentMode).toBe('image');
    // Off means "not drawn". The text is still every tile's accessible name.
    expect(question.showLabel).toBe(false);
  });
});
