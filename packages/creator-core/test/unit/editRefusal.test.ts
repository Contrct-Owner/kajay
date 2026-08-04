import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import {
  CreatorStringDictionary,
  DesignSurface,
  nameRefusal,
  refusalMessageKey,
} from '@kajay/creator-core';
import type { EditRefusalKind } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

/** Every refusal carries a reason — checklist P5, [ADR-0023]. */
const BASIC: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'who', title: 'Your name' },
        { type: 'text', name: 'where' },
      ],
    },
  ],
};

function registry(): MetadataRegistry {
  const made = new MetadataRegistry();
  registerBuiltInTypes(made);
  return made;
}

function surface(definition: SurveyDefinition = BASIC, isReadOnly = false): DesignSurface {
  return new DesignSurface({
    definition,
    registry: registry(),
    ...(isReadOnly ? { configuration: { isReadOnly: true } } : {}),
  });
}

function questionIn(designed: DesignSurface, name: string) {
  const found = designed.survey.getQuestionByName(name);
  if (found === undefined) {
    throw new Error(`No question called "${name}".`);
  }
  return found;
}

describe('parity/P5-refusal-reasons', () => {
  test('a taken name is refused, and says which name', () => {
    const designed = surface();

    const refusal = designed.setProperty(questionIn(designed, 'who'), 'name', 'where');

    // The whole point of the row. Before ADR-0023 this was `false`, the field silently put
    // the old name back, and a designer had no way to tell that from a text box that had
    // eaten their typing.
    expect(refusal).toEqual({ kind: 'name-taken', subject: 'where' });
    expect(designed.survey.getQuestionByName('who')).toBeDefined();
  });

  test('a blank name is a different refusal from a taken one', () => {
    const designed = surface();

    // Two reasons a rename fails, and a designer acts on them differently: type something,
    // or type something *else*. One `false` could not tell them apart.
    expect(designed.setProperty(questionIn(designed, 'who'), 'name', '   ')?.kind).toBe(
      'name-empty',
    );
  });

  test('a name that is free is not refused at all', () => {
    const designed = surface();

    expect(designed.setProperty(questionIn(designed, 'who'), 'name', 'whom')).toBeUndefined();
    expect(designed.survey.getQuestionByName('whom')).toBeDefined();
  });

  test('the field and the guard ask the same question', () => {
    const designed = surface();

    // ADR-0023's "one predicate, two callers". A grid that re-implemented "is this taken"
    // would drift from the model that enforces it, and the drift reads as a field
    // promising an edit the document then refuses.
    expect(nameRefusal(designed.definition, 'where')).toEqual(
      designed.setProperty(questionIn(designed, 'who'), 'name', 'where'),
    );
  });

  test('a property the type does not declare names the property', () => {
    const designed = surface();

    expect(designed.setProperty(questionIn(designed, 'who'), 'nonesuch', 'x')).toEqual({
      kind: 'unknown-property',
      subject: 'nonesuch',
    });
  });

  test('a read-only deployment refuses every edit for one reason', () => {
    const designed = surface(BASIC, true);

    // Minted at the two chokepoints, so it reaches edits that know nothing about N2 —
    // a property write, a collection change and a placement all answer the same way.
    expect(designed.setProperty(questionIn(designed, 'who'), 'title', 'Nope')?.kind).toBe(
      'read-only',
    );
    expect(designed.removeElement('who')?.kind).toBe('read-only');
    expect(designed.addChild(designed.survey, 'triggers', 'completetrigger')?.kind).toBe(
      'read-only',
    );
  });

  test('a type this deployment turned off says so, rather than nothing', () => {
    const designed = new DesignSurface({
      definition: BASIC,
      registry: registry(),
      configuration: { allowedTypes: ['text'] },
    });

    expect(
      designed.place(
        {
          kind: 'new',
          item: {
            name: 'rating',
            type: 'rating',
            title: 'Rating',
            category: 'Choice',
            keywords: [],
            defaults: {},
          },
        },
        { list: { of: 'elements', container: 'p1' }, index: 0 },
      ),
    ).toEqual({ kind: 'type-not-allowed', subject: 'rating' });
  });

  test('an element that is not there is not-found, whatever was asked of it', () => {
    const designed = surface();

    expect(designed.removeElement('ghost')?.kind).toBe('not-found');
    expect(designed.duplicate('ghost')?.kind).toBe('not-found');
    expect(designed.copy('ghost')?.kind).toBe('not-found');
  });

  test('pasting with an empty clipboard blames the clipboard, not the page', () => {
    const designed = surface();

    // Two ways a paste does nothing and only one is about the clipboard. A designer told
    // "nothing has been copied yet" while holding something copied would go hunting for a
    // bug that is not there.
    expect(designed.paste()?.kind).toBe('nothing-copied');
  });

  test('a drop that changes nothing refuses nothing', () => {
    const designed = surface();

    // The reconciliation. `PlacementSession` used to answer `'refused'` for this *and* for
    // a page dropped into a question, because `canPlace` asked one question for two
    // things. A designer putting a question back where it came from is not being told
    // "that cannot go there".
    const where = designed.locate('where');
    expect(where).toBeDefined();
    expect(designed.place({ kind: 'move', name: 'where' }, where!)).toBeUndefined();
  });

  test('a drop that must not happen still says so', () => {
    const designed = surface();

    // The other half of the same split, and the reason it is worth having: this one would
    // put a question in the survey's page list, not a designer changing their mind.
    //
    // **This case was allowed until the split.** The old `canPlace` guarded a *new* source
    // against a non-elements list and never guarded a move, so the hole was invisible while
    // one `false` covered everything — unreachable by dragging, because the session only
    // offers slots of the matching kind, and wide open to anyone calling `place`.
    expect(
      designed.place({ kind: 'move', name: 'who' }, { list: { of: 'pages' }, index: 0 })?.kind,
    ).toBe('not-placeable');
  });

  test('a move that lands where it started is not a refusal', () => {
    const designed = surface();
    const who = questionIn(designed, 'who');
    designed.addChild(who, 'validators', 'textvalidator');

    // `false` used to mean both "refused" and "nothing needed doing", which is why a
    // caller could not tell a rule from a no-op.
    expect(designed.moveChild(who, 'validators', 0, 0)).toBeUndefined();
  });
});

describe('parity/P5-refusal-words', () => {
  test('every reason has words, and they are the Creator’s own', () => {
    const kinds: readonly EditRefusalKind[] = [
      'name-empty',
      'name-taken',
      'unknown-property',
      'not-localizable',
      'read-only',
      'type-not-allowed',
      'not-found',
      'not-convertible',
      'not-placeable',
      'nothing-copied',
    ];

    const shipped = new CreatorStringDictionary();
    for (const kind of kinds) {
      // A reason with no words is a reason nobody can read, which is the defect this row
      // removes rather than a smaller version of it. Read through the dictionary, because
      // that is how a consumer reads it — and it is total, so there is no key to miss.
      expect(shipped.get('en', refusalMessageKey(kind)).length).toBeGreaterThan(0);
    }
  });

  test('a refusal is translated and white-labelled like every other string', () => {
    const dictionary = new CreatorStringDictionary();
    dictionary.register('fr', { refusalNameTaken: '« {0} » est déjà pris.' });

    expect(dictionary.get('fr', refusalMessageKey('name-taken'), 'where')).toBe(
      '« where » est déjà pris.',
    );
  });
});
