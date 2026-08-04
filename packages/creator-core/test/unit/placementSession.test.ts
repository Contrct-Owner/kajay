import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface } from '@kajay/creator-core';
import type { PlacementSource, ToolboxItem } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

const TEXT_ITEM: ToolboxItem = {
  name: 'text',
  type: 'text',
  title: 'Single-line input',
  category: 'Text',
  keywords: [],
  defaults: {},
};

const NEW_TEXT: PlacementSource = { kind: 'new', item: TEXT_ITEM };

const BASIC: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'a' },
        { type: 'text', name: 'b' },
        { type: 'text', name: 'c' },
      ],
    },
  ],
};

function surface(
  definition: SurveyDefinition = BASIC,
): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition, registry });
}

function names(designed: DesignSurface, container = designed.page?.name): readonly string[] {
  if (container === undefined) {
    return [];
  }
  const owner = findOwner(designed.definition, container);
  const elements = owner?.['elements'];
  return Array.isArray(elements)
    ? elements.map((element) => (element as SurveyDefinition)['name'] as string)
    : [];
}

function findOwner(
  definition: SurveyDefinition,
  name: string,
): SurveyDefinition | undefined {
  if (definition['name'] === name) {
    return definition;
  }
  for (const value of Object.values(definition)) {
    if (!Array.isArray(value)) {
      continue;
    }
    for (const child of value) {
      if (typeof child === 'object' && child !== null) {
        const found = findOwner(child as SurveyDefinition, name);
        if (found !== undefined) {
          return found;
        }
      }
    }
  }
  return undefined;
}

describe('placement lifecycle', () => {
  test('keyboard-style traversal previews and commits exactly once', () => {
    const designed = surface();
    const placementVersions: string[] = [];
    const surfaceVersions: string[] = [];
    designed.placement.subscribe(() => {
      placementVersions.push(`${designed.placement.snapshot.kind}:${names(designed).join(',')}`);
    });
    designed.onChanged.add(() => {
      surfaceVersions.push(`${designed.placement.snapshot.kind}:${names(designed).join(',')}`);
    });

    expect(
      designed.placement.transition({
        kind: 'start',
        source: { kind: 'move', name: 'a' },
      }),
    ).toBe('updated');
    expect(designed.placement.snapshot).toMatchObject({
      kind: 'preview',
      origin: { list: { of: 'elements', container: 'p1' }, index: 0 },
      activeSlot: undefined,
      narration: { kind: 'grabbed', position: 0, total: 3 },
    });

    expect(
      designed.placement.transition({ kind: 'step', direction: 'next' }),
    ).toBe('updated');
    expect(designed.placement.snapshot.activeSlot).toEqual({
      list: { of: 'elements', container: 'p1' },
      index: 2,
    });
    expect(names(designed)).toEqual(['a', 'b', 'c']);

    placementVersions.length = 0;
    surfaceVersions.length = 0;
    expect(
      designed.placement.transition({ kind: 'finish', action: 'commit' }),
    ).toBe('committed');

    expect(names(designed)).toEqual(['b', 'a', 'c']);
    expect(designed.selected?.getPropertyValue('name')).toBe('a');
    // Both subscriber groups see the final pair. The surface publishes first, followed
    // by the placement-specific signal used by UI adapters.
    expect(surfaceVersions).toEqual(['idle:b,a,c']);
    expect(placementVersions).toEqual(['idle:b,a,c']);
    expect(designed.undo()).toBe(true);
    expect(names(designed)).toEqual(['a', 'b', 'c']);
    expect(designed.undo()).toBe(false);
  });

  test('Escape-style abandon changes no definition or history', () => {
    const designed = surface();
    let surfaceChanges = 0;
    let placementChanges = 0;
    designed.onChanged.add(() => { surfaceChanges += 1; });
    designed.placement.subscribe(() => { placementChanges += 1; });

    designed.placement.transition({ kind: 'start', source: { kind: 'move', name: 'a' } });
    designed.placement.transition({ kind: 'step', direction: 'last' });
    expect(
      designed.placement.transition({ kind: 'finish', action: 'abandon' }),
    ).toBe('updated');

    expect(names(designed)).toEqual(['a', 'b', 'c']);
    expect(designed.canUndo).toBe(false);
    expect(surfaceChanges).toBe(0);
    expect(placementChanges).toBe(3);
    expect(designed.placement.snapshot).toMatchObject({
      kind: 'idle',
      narration: { kind: 'returned', position: 0, total: 3 },
    });
  });

  test('snapshot identity changes only for an accepted transition', () => {
    const designed = surface();
    const idle = designed.placement.snapshot;

    expect(
      designed.placement.transition({ kind: 'finish', action: 'commit' }),
    ).toBe('ignored');
    expect(designed.placement.snapshot).toBe(idle);

    designed.placement.transition({ kind: 'start', source: { kind: 'move', name: 'a' } });
    const preview = designed.placement.snapshot;
    expect(designed.placement.transition({ kind: 'aim', slot: preview.origin! })).toBe('ignored');
    expect(designed.placement.snapshot).toBe(preview);
  });
});

describe('placement domains and refusals', () => {
  test('nested slots use the same traversal and commit meaning', () => {
    const designed = surface({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'a' },
            { type: 'panel', name: 'group', elements: [{ type: 'text', name: 'inside' }] },
          ],
        },
      ],
    });

    designed.placement.transition({ kind: 'start', source: { kind: 'move', name: 'a' } });
    designed.placement.transition({ kind: 'step', direction: 'next' });
    expect(designed.placement.snapshot.activeSlot).toEqual({
      list: { of: 'elements', container: 'group' },
      index: 0,
    });
    designed.placement.transition({ kind: 'finish', action: 'commit' });

    expect(names(designed)).toEqual(['group']);
    expect(names(designed, 'group')).toEqual(['a', 'inside']);
  });

  test('a panel cannot target itself or a descendant', () => {
    const designed = surface({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'panel', name: 'group', elements: [{ type: 'text', name: 'inside' }] },
          ],
        },
      ],
    });

    expect(
      designed.placement.transition({
        kind: 'start',
        source: { kind: 'move', name: 'group' },
      }),
    ).toBe('updated');
    expect(
      designed.placement.transition({
        kind: 'aim',
        slot: { list: { of: 'elements', container: 'group' }, index: 0 },
      }),
    ).toBe('updated');
    expect(designed.placement.snapshot.activeSlot).toBeUndefined();
    expect(
      designed.placement.transition({ kind: 'finish', action: 'commit' }),
    ).toBe('refused');
    expect(names(designed)).toEqual(['group']);
  });

  test('pages use the same lifecycle and select the committed page', () => {
    const designed = surface({
      pages: [
        { name: 'p1', elements: [] },
        { name: 'p2', elements: [] },
        { name: 'p3', elements: [] },
      ],
    });

    designed.placement.transition({ kind: 'start', source: { kind: 'move', name: 'p1' } });
    designed.placement.transition({ kind: 'step', direction: 'last' });
    designed.placement.transition({ kind: 'finish', action: 'commit' });

    expect(designed.pages.map((page) => page.name)).toEqual(['p2', 'p3', 'p1']);
    expect(designed.selected?.getPropertyValue('name')).toBe('p1');
    expect(designed.page?.name).toBe('p1');
  });

  test('navigation invalidates a preview and a later finish is ignored', () => {
    const designed = surface({
      pages: [
        { name: 'p1', elements: [{ type: 'text', name: 'a' }] },
        { name: 'p2', elements: [] },
      ],
    });
    let placementChanges = 0;
    designed.placement.subscribe(() => { placementChanges += 1; });

    designed.placement.transition({ kind: 'start', source: { kind: 'move', name: 'a' } });
    designed.goToPage('p2');

    expect(designed.placement.snapshot).toMatchObject({
      kind: 'idle',
      narration: { kind: 'returned' },
    });
    expect(placementChanges).toBe(2);
    expect(
      designed.placement.transition({ kind: 'finish', action: 'commit' }),
    ).toBe('ignored');
  });

  test('definition changes and undo invalidate previews', () => {
    const designed = surface();

    designed.placement.transition({ kind: 'start', source: { kind: 'move', name: 'a' } });
    designed.setTitle(designed.survey.getQuestionByName('a')!, 'Changed');
    expect(designed.placement.snapshot).toMatchObject({
      kind: 'idle',
      narration: { kind: 'returned' },
    });

    designed.placement.transition({ kind: 'start', source: { kind: 'move', name: 'a' } });
    expect(designed.undo()).toBe(true);
    expect(designed.placement.snapshot).toMatchObject({
      kind: 'idle',
      narration: { kind: 'returned' },
    });
  });

  test('read-only and missing sources are refused without notification', () => {
    const registry = new MetadataRegistry();
    registerBuiltInTypes(registry);
    const designed = new DesignSurface({
      definition: { pages: [{ name: 'p1', elements: [] }] },
      registry,
      configuration: { isReadOnly: true },
    });
    let changes = 0;
    designed.placement.subscribe(() => { changes += 1; });

    expect(
      designed.placement.transition({
        kind: 'place',
        source: NEW_TEXT,
        slot: { list: { of: 'elements', container: 'p1' }, index: 0 },
      }),
    ).toBe('refused');
    expect(
      designed.placement.transition({ kind: 'start', source: { kind: 'move', name: 'ghost' } }),
    ).toBe('refused');
    expect(changes).toBe(0);
  });
});
