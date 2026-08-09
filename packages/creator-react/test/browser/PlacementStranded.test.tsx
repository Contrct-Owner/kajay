/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface, Toolbox } from '@kajay/creator-core';
import { DesignSurfacePanel, ToolboxPanel, useDesignerPlacement } from '@kajay/creator-react';
import type { ReactElement } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

const BASIC: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'who', title: 'Your name' },
        { type: 'text', name: 'plan', title: 'Which plan?' },
        { type: 'text', name: 'why', title: 'Why?' },
      ],
    },
  ],
};

function surface(definition: SurveyDefinition = BASIC): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition, registry });
}

function Harness({ designed }: { readonly designed: DesignSurface }): ReactElement {
  const placement = useDesignerPlacement(designed);
  return (
    <>
      <ToolboxPanel toolbox={new Toolbox()} getItemProps={placement.getItemProps} />
      <DesignSurfacePanel surface={designed} placement={placement} />
    </>
  );
}

/**
 * A drag that cannot end — the worst state this feature has.
 *
 * The element being moved has given up its box, so a *question is invisible* on the canvas,
 * the ghost is frozen wherever the pointer was, and nothing on screen offers a way out. The
 * definition is untouched, which is what makes it so disorienting: the survey is fine and
 * the canvas says otherwise. Pointer capture is meant to make it impossible, and stops
 * being able to the moment the handle stops existing mid-gesture.
 *
 * Each of these is a different way the release goes missing, and each is recoverable on its
 * own — the whole point being that no single one of them has to be the one that works.
 */
async function beginDrag(
  screen: { readonly container: HTMLElement },
  id: number,
): Promise<HTMLElement> {
  const handle = screen.container.querySelector<HTMLElement>('[data-testid="move-who"]')!;
  const target = screen.container.querySelector<HTMLElement>('[data-element-slot="why"]')!;
  const rect = target.getBoundingClientRect();
  const pointer = {
    bubbles: true,
    buttons: 1,
    pointerId: id,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height * 0.9,
  };
  Object.defineProperty(handle, 'setPointerCapture', { value: (): undefined => undefined });
  handle.dispatchEvent(new PointerEvent('pointerdown', pointer));
  handle.dispatchEvent(new PointerEvent('pointermove', pointer));
  // Waited for, because the window listener is attached by an effect: it exists from the
  // render that first shows something being carried, and not from the press. The press is
  // what the no-button-down guard covers.
  await expect
    .poll(() => screen.container.querySelector<HTMLElement>('[data-testid="drag-ghost"]')
      ?.dataset['carrying'])
    .toBe('true');
  return handle;
}

test('parity/K2-stranded: a release the handle never sees still ends the drag', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);
  await beginDrag(screen, 101);
  expect(designed.placement.snapshot.kind).toBe('preview');

  // The window has the last word, because the handle may not be there to have it: a hot
  // reload, a host re-rendering its tree, a question hidden by logic somebody just edited —
  // capture goes with the node and the release lands on nothing.
  globalThis.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 101 }));

  await expect.poll(() => designed.placement.snapshot.kind).toBe('idle');
  expect(screen.container.querySelectorAll('[data-withdrawn]')).toHaveLength(0);
  // Abandoned, not committed. Reaching here means the gesture did not end the way it was
  // supposed to, so the last aim is not evidence of what anybody intended.
  expect((designed.page?.elements ?? []).map((element) => element.name)).toEqual([
    'who',
    'plan',
    'why',
  ]);
});

test('parity/K2-stranded: a move with no button down ends it too', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);
  const handle = await beginDrag(screen, 102);

  // The other half of the same defence, and the one that recovers a *press* whose release
  // went missing before any drag began — where there is no window listener yet, because
  // nothing has started to listen for.
  handle.dispatchEvent(
    new PointerEvent('pointermove', { bubbles: true, buttons: 0, pointerId: 102 }),
  );

  await expect.poll(() => designed.placement.snapshot.kind).toBe('idle');
  expect(screen.container.querySelectorAll('[data-withdrawn]')).toHaveLength(0);
});

test('parity/K2-stranded: capture taken away ends it', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);
  const handle = await beginDrag(screen, 103);

  // A native drag starting, or the browser deciding it is finished routing this pointer.
  handle.dispatchEvent(
    new PointerEvent('lostpointercapture', { bubbles: true, pointerId: 103 }),
  );

  await expect.poll(() => designed.placement.snapshot.kind).toBe('idle');
  expect(screen.container.querySelectorAll('[data-withdrawn]')).toHaveLength(0);
});

test('parity/K2-stranded: an ordinary drop is not undone by any of them', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);
  const handle = await beginDrag(screen, 104);

  handle.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 104 }));
  // Both nets fire after a real release — `lostpointercapture` follows `pointerup`, and the
  // window listener sits above React's root. Each has to find the gesture already over and
  // do nothing, or every successful drop would be undone by its own safety net.
  handle.dispatchEvent(
    new PointerEvent('lostpointercapture', { bubbles: true, pointerId: 104 }),
  );
  globalThis.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 104 }));

  await expect.poll(() =>
    (designed.page?.elements ?? []).map((element) => element.name),
  ).toEqual(['plan', 'why', 'who']);
});
