import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface } from '@kajay/creator-core';
import type { DropSlot, PlacementSource, ToolboxItem } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

/**
 * What stands aside while a drop is being previewed — checklist K2.
 *
 * The model half of the placeholder. A view that draws where a drop would land is drawing
 * the survey as it *would be*, and the question being moved is in one place in that survey
 * rather than two — so which element gives up its place is a fact about the placement, not
 * a decision each adapter makes for itself.
 */
const TEXT_ITEM: ToolboxItem = {
  name: 'text',
  type: 'text',
  title: 'Single-line input',
  category: 'Text',
  keywords: [],
  defaults: {},
};

const BASIC: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'a' },
        { type: 'text', name: 'b' },
        { type: 'panel', name: 'group', elements: [{ type: 'text', name: 'inner' }] },
      ],
    },
  ],
};

function surface(definition: SurveyDefinition = BASIC): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition, registry });
}

function on(container: string, index: number): DropSlot {
  return { list: { of: 'elements', container }, index };
}

const MOVE_A: PlacementSource = { kind: 'move', name: 'a' };

describe('parity/K2-withdrawal', () => {
  test('the element being moved gives up its place', () => {
    const designed = surface();

    designed.placement.transition({ kind: 'start', source: MOVE_A, slot: on('p1', 2) });

    expect(designed.placement.snapshot.withdrawn).toBe('a');
    // And the definition is untouched, because a Creator drag previews and commits once
    // (ADR-0009 decision 4). Withdrawal is what the *view* shows, not an applied edit.
    expect(designed.canUndo).toBe(false);
  });

  test('a new element withdraws nothing, because it is not anywhere yet', () => {
    const designed = surface();

    designed.placement.transition({
      kind: 'start',
      source: { kind: 'new', item: TEXT_ITEM },
      slot: on('p1', 0),
    });

    expect(designed.placement.snapshot.activeSlot).toEqual(on('p1', 0));
    expect(designed.placement.snapshot.withdrawn).toBeUndefined();
  });

  test('an element aimed at the place it already occupies stays where it is', () => {
    const designed = surface();

    // The two slots that mean "where it already is" — index 0 and index 1 for the first
    // element. Neither would change anything, so neither offers an active slot, and an
    // element that vanished to illustrate a change that is not going to happen would be
    // the worst moment on the canvas to make a designer wonder where their question went.
    designed.placement.transition({ kind: 'start', source: MOVE_A, slot: on('p1', 2) });
    designed.placement.transition({ kind: 'aim', slot: on('p1', 1) });

    expect(designed.placement.snapshot.activeSlot).toBeUndefined();
    expect(designed.placement.snapshot.withdrawn).toBeUndefined();
  });

  test('aiming at nothing at all puts it back', () => {
    const designed = surface();

    designed.placement.transition({ kind: 'start', source: MOVE_A, slot: on('p1', 2) });
    // A pointer dragged off the measured surface. There is no drop to show, so there is
    // nothing for the element to be standing aside for.
    designed.placement.transition({ kind: 'aim', slot: undefined });

    expect(designed.placement.snapshot.withdrawn).toBeUndefined();
  });

  test('a move into a panel withdraws it from the page it is leaving', () => {
    const designed = surface();

    designed.placement.transition({ kind: 'start', source: MOVE_A, slot: on('group', 1) });

    expect(designed.placement.snapshot.activeSlot).toEqual(on('group', 1));
    expect(designed.placement.snapshot.withdrawn).toBe('a');
  });

  test('nothing is withdrawn once the drag is over, whichever way it ended', () => {
    const dropped = surface();
    dropped.placement.transition({ kind: 'start', source: MOVE_A, slot: on('p1', 2) });
    dropped.placement.transition({ kind: 'finish', action: 'commit' });

    const abandoned = surface();
    abandoned.placement.transition({ kind: 'start', source: MOVE_A, slot: on('p1', 2) });
    abandoned.placement.transition({ kind: 'finish', action: 'abandon' });

    // The commit is the moment the real list changes, so a view still holding a gap open
    // would show the element missing from a survey it is now actually in.
    expect(dropped.placement.snapshot.withdrawn).toBeUndefined();
    expect(abandoned.placement.snapshot.withdrawn).toBeUndefined();
  });

  test('a stale preview stops withdrawing when the document changes under it', () => {
    const designed = surface();
    designed.placement.transition({ kind: 'start', source: MOVE_A, slot: on('p1', 2) });

    designed.removeElement('b');
    designed.placement.transition({ kind: 'aim', slot: on('p1', 2) });

    // The revision moved, so the preview is invalidated rather than re-aimed. An adapter
    // that kept the gap open would be reserving space in a page that no longer exists.
    expect(designed.placement.snapshot.kind).toBe('idle');
    expect(designed.placement.snapshot.withdrawn).toBeUndefined();
  });
});
