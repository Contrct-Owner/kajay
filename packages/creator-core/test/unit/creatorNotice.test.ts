import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import {
  CreatorStringDictionary,
  DesignSurface,
  JsonEditorSession,
  Toolbox,
  noticeMessageKey,
} from '@kajay/creator-core';
import type { CreatorNotice, CreatorNoticeKind } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

/** What the Creator did unasked — checklist P6, [ADR-0023]. */
const NESTED: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        {
          type: 'panel',
          name: 'group',
          elements: [
            { type: 'text', name: 'who' },
            { type: 'text', name: 'where' },
          ],
        },
        {
          type: 'radiogroup',
          name: 'tier',
          choices: ['bronze', 'silver'],
          isRequired: true,
        },
      ],
    },
  ],
};

function registry(): MetadataRegistry {
  const made = new MetadataRegistry();
  registerBuiltInTypes(made);
  return made;
}

function surfaceWith(definition: SurveyDefinition = NESTED): {
  readonly surface: DesignSurface;
  readonly heard: CreatorNotice[];
} {
  const surface = new DesignSurface({ definition, registry: registry() });
  const heard: CreatorNotice[] = [];
  surface.onNotice.add((received) => heard.push(received));
  return { surface, heard };
}

describe('parity/P6-notices', () => {
  test('a paste that had to renumber names says how many', () => {
    const { surface, heard } = surfaceWith();
    surface.copy('tier');

    surface.paste();

    // Their `tier` is now `tier1`, and they will go looking for `tier`. This is the case
    // that makes the whole row worth having.
    expect(heard).toEqual([{ kind: 'renamed-on-paste', count: 1 }]);
  });

  test('a paste with nothing to renumber says nothing', () => {
    const { surface, heard } = surfaceWith();
    surface.copy('tier');
    surface.removeElement('tier');

    surface.paste();

    // A message about nothing is how people learn to skip messages.
    expect(heard).toEqual([]);
  });

  test('a conversion that drops settings says which element and how many', () => {
    const { surface, heard } = surfaceWith();

    surface.convert('tier', 'text');

    // The one edit here that loses a designer's typing — `choices` has no place on a text
    // question — so the one that most needs to say so.
    expect(heard[0]?.kind).toBe('properties-dropped');
    expect(heard[0]?.subject).toBe('tier');
    expect(heard[0]?.count).toBeGreaterThan(0);
  });

  test('a conversion that keeps everything says nothing', () => {
    const { surface, heard } = surfaceWith();

    // `isRequired` and `choices` both survive the move to a checkbox, so nothing was lost
    // and there is nothing to report.
    surface.convert('tier', 'checkbox');

    expect(heard).toEqual([]);
  });

  test('deleting a container says what went with it', () => {
    const { surface, heard } = surfaceWith();

    surface.removeElement('group');

    // One gesture, three elements gone. K7 made that the operation rather than a side
    // effect, which is exactly why it is worth saying out loud.
    expect(heard).toEqual([{ kind: 'removed-with-children', subject: 'group', count: 2 }]);
  });

  test('deleting a lone question says nothing', () => {
    const { surface, heard } = surfaceWith();

    surface.removeElement('tier');

    // Nothing surprising happened: they deleted one thing and one thing went.
    expect(heard).toEqual([]);
  });

  test('a dropped question that arrives with starter content says so', () => {
    const { surface, heard } = surfaceWith();
    const dropdown = new Toolbox({ registry: registry() }).items.find(
      (item) => item.type === 'dropdown',
    );

    surface.place(
      { kind: 'new', item: dropdown! },
      { list: { of: 'elements', container: 'p1' }, index: 0 },
    );

    // N5's starter choices are content the designer did not type, appearing in their
    // survey. Small, and exactly the kind of thing that is baffling in silence.
    expect(heard[0]?.kind).toBe('starter-content');
  });

  test('a type with no starter content stays quiet', () => {
    const { surface, heard } = surfaceWith();
    const comment = new Toolbox({ registry: registry() }).items.find(
      (item) => item.type === 'comment',
    );

    surface.place(
      { kind: 'new', item: comment! },
      { list: { of: 'elements', container: 'p1' }, index: 0 },
    );

    expect(heard).toEqual([]);
  });

  test('applying JSON says the designer now shows something else', () => {
    const { surface, heard } = surfaceWith();
    const json = new JsonEditorSession(surface);
    json.setText(JSON.stringify({ pages: [{ name: 'p1', elements: [] }] }));

    expect(json.apply()).toBe(true);

    // The one surface where a designer changes the whole survey in a keystroke.
    expect(heard).toEqual([{ kind: 'survey-replaced' }]);
  });

  test('a refused edit announces nothing at all', () => {
    const surface = new DesignSurface({
      definition: NESTED,
      registry: registry(),
      configuration: { isReadOnly: true },
    });
    const heard: CreatorNotice[] = [];
    surface.onNotice.add((received) => heard.push(received));

    surface.removeElement('group');
    surface.convert('tier', 'text');

    // Announcing what an edit *would* have done is worse than silence: it describes a
    // survey the designer does not have. The refusal is the answer, and P5 delivers it.
    expect(heard).toEqual([]);
  });
});

describe('parity/P6-notice-words', () => {
  test('every notice has words, and they are the Creator’s own', () => {
    const kinds: readonly CreatorNoticeKind[] = [
      'renamed-on-paste',
      'properties-dropped',
      'removed-with-children',
      'starter-content',
      'survey-replaced',
    ];
    const shipped = new CreatorStringDictionary();

    for (const kind of kinds) {
      expect(shipped.get('en', noticeMessageKey(kind)).length).toBeGreaterThan(0);
    }
  });

  test('a notice is translated and white-labelled like every other string', () => {
    const dictionary = new CreatorStringDictionary();
    dictionary.register('fr', { noticeRemovedWithChildren: '« {0} » supprimé, avec {1} éléments.' });

    expect(dictionary.get('fr', noticeMessageKey('removed-with-children'), 'group', 2)).toBe(
      '« group » supprimé, avec 2 éléments.',
    );
  });
});
