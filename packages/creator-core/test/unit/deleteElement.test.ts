import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

/** Deleting a question or a panel — checklist K7. */
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

describe('parity/K7-delete', () => {
  test('a question goes, and the neighbour is selected', () => {
    const designed = surface();

    expect(designed.removeElement('who')).toBe(true);

    // Not "nothing selected": a designer deleting one of several questions is still
    // working on that page, and an empty property grid reads as having lost their place.
    expect(names(designed)).toEqual(['tier']);
    expect(designed.selected?.getPropertyValue('name')).toBe('tier');
  });

  test('deleting the last one selects the one before it', () => {
    const designed = surface();

    designed.removeElement('tier');

    expect(designed.selected?.getPropertyValue('name')).toBe('who');
  });

  test('deleting the only one selects nothing, because there is nothing', () => {
    const designed = surface({
      pages: [{ name: 'p1', elements: [{ type: 'text', name: 'only' }] }],
    });

    designed.removeElement('only');

    expect(names(designed)).toEqual([]);
    expect(designed.selected).toBeUndefined();
  });

  test('a panel takes its questions with it', () => {
    const designed = surface({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'panel', name: 'group', elements: [{ type: 'text', name: 'inner' }] },
          ],
        },
      ],
    });

    designed.removeElement('group');

    // The operation, not a side effect — the same argument K4 made about a page.
    expect(designed.survey.getQuestionByName('inner')).toBeUndefined();
  });

  test('deleting is undoable, and brings the whole subtree back', () => {
    const designed = surface({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'panel', name: 'group', elements: [{ type: 'text', name: 'inner' }] },
          ],
        },
      ],
    });
    designed.removeElement('group');

    designed.undo();

    // Nothing in the deletion knows about undo. It goes through `applyEdit`, so the
    // subtree comes back without anything having written an inverse for it.
    expect(designed.survey.getQuestionByName('inner')).toBeDefined();
  });

  test('deleting something that is not there does nothing', () => {
    const designed = surface();

    expect(designed.removeElement('ghost')).toBe(false);
    expect(designed.canUndo).toBe(false);
  });
});
