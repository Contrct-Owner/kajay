import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface } from '@kajay/creator-core';
import type { DropList, PlacementSource } from '@kajay/creator-core';
import { applyPlacement, canPlace, dropSlotsOn } from '../../src/placement.js';
import { describe, expect, test } from 'vitest';

/** Dropping into a panel — checklist K2's last gap. */
const P1: DropList = { of: 'elements', container: 'p1' };
const GROUP: DropList = { of: 'elements', container: 'group' };

/** A page holding `who`, a panel `group` holding `inner`, and `why`. */
function nested(): SurveyDefinition {
  return {
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'text', name: 'who' },
          { type: 'panel', name: 'group', elements: [{ type: 'text', name: 'inner' }] },
          { type: 'text', name: 'why' },
        ],
      },
    ],
  };
}

function surface(definition: SurveyDefinition = nested()): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition, registry });
}

function insideGroup(definition: SurveyDefinition): readonly string[] {
  const pages = definition['pages'] as readonly SurveyDefinition[];
  const elements = pages[0]!['elements'] as readonly SurveyDefinition[];
  const group = elements.find((element) => element['name'] === 'group')!;
  return (group['elements'] as readonly SurveyDefinition[]).map(
    (element) => element['name'] as string,
  );
}

function onPage(definition: SurveyDefinition): readonly string[] {
  const pages = definition['pages'] as readonly SurveyDefinition[];
  return (pages[0]!['elements'] as readonly SurveyDefinition[]).map(
    (element) => element['name'] as string,
  );
}

describe('parity/K2-nesting', () => {
  test('a panel is a container the model can read', () => {
    const after = applyPlacement(nested(), { kind: 'move', name: 'who' }, { list: GROUP, index: 1 });

    // The same `applyPlacement`, the same off-by-one, the same refusals. All a panel
    // ever needed was to be findable — the placement model was already right.
    expect(insideGroup(after)).toEqual(['inner', 'who']);
    expect(onPage(after)).toEqual(['group', 'why']);
  });

  test('an element moves back out of a panel', () => {
    const inPanel = applyPlacement(nested(), { kind: 'move', name: 'who' }, { list: GROUP, index: 1 });

    const after = applyPlacement(inPanel, { kind: 'move', name: 'who' }, { list: P1, index: 0 });

    expect(onPage(after)).toEqual(['who', 'group', 'why']);
    expect(insideGroup(after)).toEqual(['inner']);
  });

  test('a new element from the toolbox lands inside the panel', () => {
    const designed = surface();

    designed.place(
      { kind: 'new', item: { name: 'text', type: 'text', title: 'Text', category: 'x', keywords: [], defaults: {} } },
      { list: GROUP, index: 0 },
    );

    expect(insideGroup(designed.definition)).toEqual(['text1', 'inner']);
  });

  test('only the containers on the path are copied', () => {
    const before = nested();

    const after = applyPlacement(before, { kind: 'move', name: 'who' }, { list: GROUP, index: 1 });
    const beforePages = before['pages'] as readonly SurveyDefinition[];
    const afterPages = after['pages'] as readonly SurveyDefinition[];

    // `why` is untouched by a drop into the panel beside it, and is shared rather than
    // cloned — dropping three levels down should not rebuild the questions around it.
    const beforeWhy = (beforePages[0]!['elements'] as readonly SurveyDefinition[])[2];
    const afterWhy = (afterPages[0]!['elements'] as readonly SurveyDefinition[])[1];
    expect(afterWhy).toBe(beforeWhy);
  });
});

describe('parity/K2-nesting-refusals', () => {
  const moveGroup: PlacementSource = { kind: 'move', name: 'group' };

  test('a panel cannot be dropped into itself', () => {
    // It would detach the subtree from the survey and leave it pointing at itself — a
    // definition no parser can make sense of, not merely a page that looks wrong.
    expect(canPlace(nested(), moveGroup, { list: GROUP, index: 0 })).toBe(false);
  });

  test('a panel cannot be dropped into its own descendant', () => {
    const deep: SurveyDefinition = {
      pages: [
        {
          name: 'p1',
          elements: [
            {
              type: 'panel',
              name: 'outer',
              elements: [{ type: 'panel', name: 'middle', elements: [] }],
            },
          ],
        },
      ],
    };

    expect(
      canPlace(deep, { kind: 'move', name: 'outer' }, {
        list: { of: 'elements', container: 'middle' },
        index: 0,
      }),
    ).toBe(false);
  });

  test('a panel can still be dropped beside a sibling panel', () => {
    const two: SurveyDefinition = {
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'panel', name: 'first', elements: [] },
            { type: 'panel', name: 'second', elements: [] },
          ],
        },
      ],
    };

    // The refusal is about descendants, not about panels. Refusing every panel-into-panel
    // move would be the easy over-correction.
    expect(
      canPlace(two, { kind: 'move', name: 'first' }, {
        list: { of: 'elements', container: 'second' },
        index: 0,
      }),
    ).toBe(true);
  });
});

/**
 * What counts as a container.
 *
 * Supplied by the caller, because the definition cannot say: an empty panel serializes
 * without its `elements` at all, so by shape it is a text question.
 */
const isPanel = (type: string): boolean => type === 'panel';

describe('parity/K2-slot-walk', () => {
  test('the slots of a page read in the order they are on screen', () => {
    expect(dropSlotsOn(nested(), 'p1', isPanel)).toEqual([
      { list: P1, index: 0 },
      { list: P1, index: 1 },
      { list: GROUP, index: 0 },
      { list: GROUP, index: 1 },
      { list: P1, index: 2 },
      { list: P1, index: 3 },
    ]);
  });

  test('an empty panel still offers the one slot inside it', () => {
    const slots = dropSlotsOn(
      { pages: [{ name: 'p1', elements: [{ type: 'panel', name: 'group' }] }] },
      'p1',
      isPanel,
    );

    // Written *without* an `elements` key on purpose: that is how an empty panel comes
    // back from `serializeSurvey`, and guessing containers from the shape made a panel a
    // designer had just added the one place on the canvas nothing could go.
    expect(slots).toEqual([
      { list: P1, index: 0 },
      { list: GROUP, index: 0 },
      { list: P1, index: 1 },
    ]);
  });

  test('a page the survey does not have offers nothing', () => {
    expect(dropSlotsOn(nested(), 'ghost', isPanel)).toEqual([]);
  });
});
