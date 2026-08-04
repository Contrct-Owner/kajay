import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface } from '@kajay/creator-core';
import type { ToolboxItem } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

const TEXT_ITEM: ToolboxItem = {
  name: 'text',
  type: 'text',
  title: 'Single-line input',
  category: 'Text',
  keywords: [],
  defaults: {},
};

function surface(definition: SurveyDefinition): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition, registry });
}

describe('placement narration', () => {
  test('atomic new placement counts from the pre-edit definition', () => {
    const designed = surface({
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
    });

    expect(
      designed.placement.transition({
        kind: 'place',
        source: { kind: 'new', item: TEXT_ITEM },
        slot: { list: { of: 'elements', container: 'p1' }, index: 3 },
      }),
    ).toBe('committed');

    expect(designed.placement.snapshot).toMatchObject({
      kind: 'idle',
      narration: { kind: 'dropped', position: 3, total: 4, container: 'p1' },
    });
  });

  test('cross-container total is destination count plus the moved item, once', () => {
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

    designed.placement.transition({
      kind: 'place',
      source: { kind: 'move', name: 'a' },
      slot: { list: { of: 'elements', container: 'group' }, index: 1 },
    });

    expect(designed.placement.snapshot).toMatchObject({
      narration: { kind: 'dropped', position: 1, total: 2, container: 'group' },
    });
  });
});
