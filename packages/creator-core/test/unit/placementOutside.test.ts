import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import { DesignSurface } from '@kajay/creator-core';
import { expect, test } from 'vitest';

function surface(): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({
    registry,
    definition: {
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
    },
  });
}

function names(designed: DesignSurface): readonly string[] {
  return (designed.page?.elements ?? []).map((element) => element.name);
}

test('aiming outside clears the target, refuses drop, and can resume', () => {
  const designed = surface();
  let surfaceChanges = 0;
  designed.onChanged.add(() => { surfaceChanges += 1; });

  designed.placement.transition({ kind: 'start', source: { kind: 'move', name: 'a' } });
  designed.placement.transition({ kind: 'step', direction: 'next' });
  const valid = designed.placement.snapshot.activeSlot!;
  expect(designed.placement.transition({ kind: 'aim', slot: undefined })).toBe('updated');
  expect(designed.placement.snapshot).toMatchObject({ kind: 'preview', activeSlot: undefined });

  expect(
    designed.placement.transition({ kind: 'finish', action: 'commit' }),
  ).toBe('refused');
  expect(designed.placement.snapshot).toMatchObject({
    kind: 'idle',
    narration: { kind: 'returned', position: 0, total: 3 },
  });
  expect(names(designed)).toEqual(['a', 'b', 'c']);
  expect(designed.canUndo).toBe(false);
  expect(surfaceChanges).toBe(0);

  designed.placement.transition({ kind: 'start', source: { kind: 'move', name: 'a' } });
  designed.placement.transition({ kind: 'aim', slot: undefined });
  expect(designed.placement.transition({ kind: 'aim', slot: valid })).toBe('updated');
  expect(
    designed.placement.transition({ kind: 'finish', action: 'commit' }),
  ).toBe('committed');
  expect(names(designed)).toEqual(['b', 'a', 'c']);
});
