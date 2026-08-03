import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { childrenIn, DesignSurface, fastEntryItems, fastEntryText } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

/** Fast entry — checklist L2. One item per line, `value` or `value|text`. */
function surface(definition: SurveyDefinition): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition, registry });
}

function tierOf(designed: DesignSurface) {
  return designed.survey.getQuestionByName('tier')!;
}

function choicesOf(designed: DesignSurface, owner = 'tier'): readonly SurveyDefinition[] {
  return childrenIn(designed.definition, owner, 'choices') ?? [];
}

const WITH_CHOICES: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        {
          type: 'radiogroup',
          name: 'tier',
          choices: [
            { value: 'bronze' },
            { value: 'silver', text: 'Silver', visibleIf: '{who} notempty' },
          ],
        },
        { type: 'text', name: 'who' },
      ],
    },
  ],
};

describe('parity/L2-fast-entry', () => {
  test('an item whose text is its value is written as the bare value', () => {
    const text = fastEntryText(
      [{ value: 'bronze' }, { value: 'silver', text: 'Silver' }, { value: 'gold', text: 'gold' }],
      'value',
    );

    // Round-tripping `gold` as `gold|gold` would teach a designer a distinction that is
    // not there.
    expect(text).toBe('bronze\nsilver|Silver\ngold');
  });

  test('an unchanged value keeps everything a line cannot say', () => {
    const items = fastEntryItems('bronze\nsilver|Silver tier', 'value', [
      { value: 'bronze' },
      { value: 'silver', text: 'Silver', visibleIf: '{who} notempty' },
    ]);

    // Rebuilding the list from the text alone would mean that fixing a typo on one line
    // silently deleted the conditional visibility on another — a fast entry that is only
    // safe on lists nobody has customized.
    expect(items[1]).toEqual({
      value: 'silver',
      text: 'Silver tier',
      visibleIf: '{who} notempty',
    });
  });

  test('a value authored as a number stays a number', () => {
    const items = fastEntryItems('1|One\n2', 'value', [{ value: 1 }, { value: 2 }]);

    // The line says `1` either way, so writing the string back would be this editor
    // quietly changing the type of an answer key.
    expect(items.map((item) => item['value'])).toEqual([1, 2]);
  });

  test('blank lines are how people type, not requests for empty choices', () => {
    expect(fastEntryItems('bronze\n\n  \nsilver\n', 'value', [])).toEqual([
      { value: 'bronze' },
      { value: 'silver' },
    ]);
  });

  test('clearing the label removes the text', () => {
    const items = fastEntryItems('silver', 'value', [{ value: 'silver', text: 'Silver' }]);

    expect(items[0]).toEqual({ value: 'silver' });
  });
});

describe('parity/L2-fast-entry-locale', () => {
  const LOCALIZED: readonly SurveyDefinition[] = [
    { value: 'silver', text: { default: 'Silver', fr: 'Argent' } },
  ];

  test('a localized text is shown in the survey’s own language', () => {
    expect(fastEntryText(LOCALIZED, 'value', 'fr')).toBe('silver|Argent');
  });

  test('a localized text is edited in place, never replaced', () => {
    const items = fastEntryItems('silver|Argenté', 'value', LOCALIZED, 'fr');

    // L1's rule, one level down: retyping one line of a French choice list must not throw
    // away its English.
    expect(items[0]?.['text']).toEqual({ default: 'Silver', fr: 'Argenté' });
  });

  test('clearing a label removes one language, not the object', () => {
    const items = fastEntryItems('silver', 'value', LOCALIZED, 'fr');

    expect(items[0]?.['text']).toEqual({ default: 'Silver' });
  });

  test('clearing the last language removes the property', () => {
    const items = fastEntryItems('silver', 'value', [{ value: 'silver', text: { fr: 'Argent' } }], 'fr');

    // An empty `{}` in a definition is a shape nobody wrote.
    expect(items[0]).toEqual({ value: 'silver' });
  });
});

describe('parity/L2-fast-entry-edit', () => {
  test('a rewritten list is one edit and one press of undo', () => {
    const designed = surface(WITH_CHOICES);

    expect(designed.setFastEntry(tierOf(designed), 'choices', 'bronze\nsilver|Silver\ngold')).toBe(
      true,
    );
    expect(choicesOf(designed).map((child) => child['value'])).toEqual([
      'bronze',
      'silver',
      'gold',
    ]);

    designed.undo();
    expect(choicesOf(designed).map((child) => child['value'])).toEqual(['bronze', 'silver']);
  });

  test('reordering by moving a line keeps what the moved item carried', () => {
    const designed = surface(WITH_CHOICES);

    designed.setFastEntry(tierOf(designed), 'choices', 'silver|Silver\nbronze');

    // Matching on value rather than on position is what makes this true: the item that
    // moved is the same item, so its `visibleIf` moved with it.
    expect(choicesOf(designed)[0]?.['visibleIf']).toBe('{who} notempty');
  });

  test('a collection with no shorthand cannot be typed as text', () => {
    const designed = surface(WITH_CHOICES);

    // A validator has no scalar form, so there is nothing for a line to be — and a text
    // question has no choices at all.
    expect(designed.setFastEntry(tierOf(designed), 'validators', 'a')).toBe(false);
    expect(designed.setFastEntry(designed.survey.getQuestionByName('who')!, 'choices', 'a')).toBe(
      false,
    );
  });
});
