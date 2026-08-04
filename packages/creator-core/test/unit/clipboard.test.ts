import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface } from '@kajay/creator-core';
import { freshenFragment } from '../../src/fragments.js';
import { describe, expect, test } from 'vitest';

/** Copy, paste, duplicate and convert — checklist K5. */
function registry(): MetadataRegistry {
  const created = new MetadataRegistry();
  registerBuiltInTypes(created);
  return created;
}

const BASIC: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'who', title: 'Your name' },
        {
          type: 'radiogroup',
          name: 'tier',
          title: 'Which tier?',
          choices: ['bronze', 'silver'],
          visibleIf: '{who} notempty',
          isRequired: true,
        },
      ],
    },
  ],
};

function surface(definition: SurveyDefinition = BASIC): DesignSurface {
  return new DesignSurface({ definition, registry: registry() });
}

function names(designed: DesignSurface): readonly string[] {
  return (designed.page?.elements ?? []).map((element) => element.name);
}

function elementOf(designed: DesignSurface, name: string): SurveyDefinition {
  const pages = designed.definition['pages'] as readonly SurveyDefinition[];
  const elements = pages[0]!['elements'] as readonly SurveyDefinition[];
  return elements.find((element) => element['name'] === name)!;
}

describe('parity/K5-freshen', () => {
  test('a name already free is kept', () => {
    const { fragment, renames } = freshenFragment({ type: 'text', name: 'who' }, new Set(['other']));

    // A fragment pasted into a different survey should read exactly as it was written.
    expect(fragment['name']).toBe('who');
    // And nothing to announce, because nothing was renumbered (ADR-0023).
    expect(renames.size).toBe(0);
  });

  test('a name that is taken is numbered from its stem', () => {
    const { fragment, renames } = freshenFragment(
      { type: 'text', name: 'who2' },
      new Set(['who2', 'who3']),
    );

    // `who4`, not `who21` — the second reads as a typo and sorts nowhere sensible.
    expect(fragment['name']).toBe('who4');
    expect(renames.get('who2')).toBe('who4');
  });

  test('a reference inside the copy follows the copy', () => {
    const { fragment: fresh } = freshenFragment(
      {
        type: 'panel',
        name: 'group',
        elements: [
          { type: 'text', name: 'first' },
          { type: 'text', name: 'second', visibleIf: "{first} = 'yes'" },
        ],
      },
      new Set(['group', 'first', 'second']),
    );
    const elements = fresh['elements'] as readonly SurveyDefinition[];

    // A duplicated panel means *its own* first question. Renaming without rewriting
    // leaves a copy that looks right and is quietly wired to somebody else's questions.
    expect(elements[0]!['name']).toBe('first2');
    expect(elements[1]!['visibleIf']).toBe("{first2} = 'yes'");
  });

  test('a reference out of the copy is left alone', () => {
    const { fragment: fresh } = freshenFragment(
      { type: 'text', name: 'who', visibleIf: '{consent} = true' },
      new Set(['who']),
    );

    // `consent` was not copied, so there is nothing else the reference could mean.
    expect(fresh['visibleIf']).toBe('{consent} = true');
  });

  test('references are rewritten in every string, not only expressions', () => {
    const { fragment: fresh } = freshenFragment(
      {
        type: 'panel',
        name: 'group',
        elements: [
          { type: 'text', name: 'city' },
          { type: 'html', name: 'note', html: '<p>You said {city}, in {city.region}.</p>' },
        ],
      },
      new Set(['group', 'city', 'note']),
    );
    const elements = fresh['elements'] as readonly SurveyDefinition[];

    // `{city}` in a heading is the same reference by the same syntax as `{city}` in a
    // `visibleIf` (B6's piping). A rewrite covering one and not the other leaves a copy
    // that behaves correctly and reads wrongly.
    expect(elements[1]!['html']).toBe('<p>You said {city2}, in {city2.region}.</p>');
  });

  test('a longer name that starts the same is not rewritten', () => {
    const { fragment: fresh } = freshenFragment(
      {
        type: 'panel',
        name: 'group',
        elements: [
          { type: 'text', name: 'who' },
          { type: 'text', name: 'whoever', visibleIf: '{whoever} notempty and {who} notempty' },
        ],
      },
      new Set(['group', 'who']),
    );
    const elements = fresh['elements'] as readonly SurveyDefinition[];

    // `whoever` is free, so it keeps its name — and `{whoever}` must not be caught by
    // the rewrite of `{who}`. The boundary is the whole reason this is not a substring
    // replace.
    expect(elements[1]!['visibleIf']).toBe('{whoever} notempty and {who2} notempty');
  });
});

describe('parity/K5-duplicate', () => {
  test('a copy lands straight after the original', () => {
    const designed = surface();

    expect(designed.duplicate('who')).toBeUndefined();

    // A duplicate is nearly always the start of "and one more like that", and the two
    // belong together while the designer edits the second.
    expect(names(designed)).toEqual(['who', 'who2', 'tier']);
  });

  test('the copy is the same question under a different name', () => {
    const designed = surface();
    designed.duplicate('tier');

    // Compared against the original rather than against a literal: a literal would pin
    // how `choices` happens to canonicalize, which is the serializer's business and not
    // this row's. What K5 claims is that *only the name* differs.
    const copy = { ...elementOf(designed, 'tier2'), name: 'tier' };
    expect(copy).toEqual(elementOf(designed, 'tier'));
  });

  test('the copy is what is selected', () => {
    const designed = surface();
    designed.duplicate('who');

    expect(designed.selected?.getPropertyValue('name')).toBe('who2');
  });

  test('duplicating something that is not there does nothing', () => {
    const designed = surface();

    expect(designed.duplicate('ghost')?.kind).toBe('not-found');
    expect(designed.canUndo).toBe(false);
  });
});

describe('parity/K5-clipboard', () => {
  test('nothing can be pasted until something is copied', () => {
    const designed = surface();

    expect(designed.canPaste).toBe(false);
    expect(designed.paste()?.kind).toBe('nothing-copied');
  });

  test('copying is announced but not recorded', () => {
    const designed = surface();
    const seen: number[] = [];
    designed.onChanged.add((version) => seen.push(version));

    designed.copy('who');

    // Announced, because whether Paste is available is on screen and nothing else would
    // redraw it. Not recorded, because the survey did not change — the first version of
    // this was silent, and the button stayed disabled with something on the clipboard.
    expect(seen).toHaveLength(1);
    expect(designed.canUndo).toBe(false);
  });

  test('a copy survives the edits made between copying and pasting', () => {
    const designed = surface();
    designed.copy('tier');
    designed.duplicate('who');

    expect(designed.paste()).toBeUndefined();

    // The clipboard holds a definition fragment, not an element — nothing survives a
    // re-parse by identity, and there have been two since.
    expect(names(designed)).toContain('tier2');
  });

  test('paste lands after the selection', () => {
    const designed = surface();
    designed.copy('tier');
    designed.select(designed.survey.getQuestionByName('who')!);

    designed.paste();

    expect(names(designed)).toEqual(['who', 'tier2', 'tier']);
  });

  test('paste with nothing selected lands at the end', () => {
    const designed = surface();
    designed.copy('who');
    designed.clearSelection();

    designed.paste();

    // "Somewhere" is not a useful answer, and the selection is the only thing on screen
    // that says where a designer is working.
    expect(names(designed)).toEqual(['who', 'tier', 'who2']);
  });
});

describe('parity/K5-convert', () => {
  test('a question keeps what the new type understands', () => {
    const designed = surface();
    const before = elementOf(designed, 'tier');

    expect(designed.convert('tier', 'dropdown')).toBeUndefined();

    // A designer who picked the wrong type should not have to retype the question, so
    // everything the two types share survives — only `type` moved.
    expect(elementOf(designed, 'tier')).toEqual({ ...before, type: 'dropdown' });
  });

  test('what the new type has no notion of is dropped', () => {
    const designed = surface();

    designed.convert('tier', 'text');

    // A text question has no choices. Carrying them invisibly would mean they reappear
    // if somebody converts back, which is state nobody can see or edit.
    expect(elementOf(designed, 'tier')['choices']).toBeUndefined();
    expect(elementOf(designed, 'tier')['title']).toBe('Which tier?');
  });

  test('converting is undoable, like everything else', () => {
    const designed = surface();
    const before = elementOf(designed, 'tier');
    designed.convert('tier', 'text');

    designed.undo();

    // Nothing in the conversion knows about undo. It goes through `applyEdit`, which is
    // the whole of what K6 asked of every future editing feature.
    expect(elementOf(designed, 'tier')).toEqual(before);
  });

  test('a panel is not convertible, in either direction', () => {
    const designed = surface({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'panel', name: 'group', elements: [{ type: 'text', name: 'inner' }] },
            { type: 'text', name: 'who' },
          ],
        },
      ],
    });

    // Converting a panel would drop the elements the target type has no notion of — a
    // delete dressed up as a change of type. The mirror case would put an empty
    // container where a question used to be.
    expect(designed.convert('group', 'text')?.kind).toBe('not-convertible');
    expect(designed.convert('who', 'panel')?.kind).toBe('not-convertible');
    expect(designed.survey.getQuestionByName('inner')).toBeDefined();
  });

  test('converting to the type it already is does nothing', () => {
    const designed = surface();

    expect(designed.convert('who', 'text')?.kind).toBe('not-convertible');
    expect(designed.canUndo).toBe(false);
  });

  test('the offered types are questions, and exclude no built-in one', () => {
    const designed = surface();

    expect(designed.convertibleTypes).toContain('dropdown');
    expect(designed.convertibleTypes).toContain('rating');
    expect(designed.convertibleTypes).not.toContain('panel');
  });
});
