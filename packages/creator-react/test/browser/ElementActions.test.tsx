/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface } from '@kajay/creator-core';
import { DesignSurfacePanel } from '@kajay/creator-react';
import { userEvent } from 'vitest/browser';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/** Copy, paste, duplicate and convert (K5), and deletion (K7). */
const BASIC: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'who', title: 'Your name' },
        { type: 'radiogroup', name: 'tier', title: 'Which tier?', choices: ['bronze', 'silver'] },
      ],
    },
  ],
};

function surface(): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition: BASIC, registry });
}

function names(designed: DesignSurface): readonly string[] {
  return (designed.page?.elements ?? []).map((element) => element.name);
}

test('parity/K5-actions: they appear only on the selected element', async () => {
  const designed = surface();
  const screen = await render(<DesignSurfacePanel surface={designed} />);

  // A control on every question would bury the survey under the tools for editing it —
  // K3's argument for the title editor, applied to the rest. P4 turned four buttons into
  // one menu; the rule about when they appear is unchanged.
  expect(screen.container.querySelectorAll('.kajay-designer__menu')).toHaveLength(0);

  await screen.getByTestId('select-who').click();
  expect(screen.container.querySelectorAll('.kajay-designer__menu')).toHaveLength(1);
});

test('parity/K5-duplicate: the copy lands next to the original and is selected', async () => {
  const designed = surface();
  const screen = await render(<DesignSurfacePanel surface={designed} />);
  await screen.getByTestId('select-who').click();

  await openActions(screen, 'who');
  await screen.getByTestId('duplicate-who').click();

  expect(names(designed)).toEqual(['who', 'who2', 'tier']);
  // The real renderer draws it, so the copy has the original's title on screen too.
  await expect.element(screen.getByTestId('select-who2')).toBeInTheDocument();
  expect(designed.selected?.getPropertyValue('name')).toBe('who2');
});

test('parity/K5-paste: nothing can be pasted until something is copied', async () => {
  const designed = surface();
  const screen = await render(<DesignSurfacePanel surface={designed} />);
  await screen.getByTestId('select-who').click();

  await openActions(screen, 'who');
  await expect.element(screen.getByTestId('paste-who')).toBeDisabled();

  // No second open: the menu is still up, and choosing Copy is what closes it. Toggling
  // the trigger again would shut it — which is the menu behaving, and was worth finding
  // out here rather than from a designer.
  await screen.getByTestId('copy-who').click();
  await openActions(screen, 'who');
  await expect.element(screen.getByTestId('paste-who')).toBeEnabled();
});

test('parity/K5-paste: it lands after the selection', async () => {
  const designed = surface();
  const screen = await render(<DesignSurfacePanel surface={designed} />);
  await screen.getByTestId('select-tier').click();
  await openActions(screen, 'tier');
  await screen.getByTestId('copy-tier').click();

  await screen.getByTestId('select-who').click();
  await openActions(screen, 'who');
  await screen.getByTestId('paste-who').click();

  expect(names(designed)).toEqual(['who', 'tier2', 'tier']);
});

// **The conversion scenarios moved to the property grid** — checklist P11. The picker is
// no longer in the adorner, so `DesignSurfacePanel` alone cannot reach it; see
// `PropertyGrid.test.tsx`, which renders the grid the picker now lives in.

test('parity/K7-delete: the button removes the question', async () => {
  const designed = surface();
  const screen = await render(<DesignSurfacePanel surface={designed} />);
  await screen.getByTestId('select-who').click();

  await openActions(screen, 'who');
  await screen.getByTestId('delete-who').click();

  expect(names(designed)).toEqual(['tier']);
  expect(screen.container.querySelectorAll('[data-element-index]')).toHaveLength(1);
});

test('parity/K7-delete: the Delete key removes the selection', async () => {
  const designed = surface();
  const screen = await render(<DesignSurfacePanel surface={designed} />);

  await screen.getByTestId('select-who').click();
  await userEvent.keyboard('{Delete}');

  expect(names(designed)).toEqual(['tier']);
});

test('parity/K7-delete: Backspace deliberately does not', async () => {
  const designed = surface();
  const screen = await render(<DesignSurfacePanel surface={designed} />);

  await screen.getByTestId('select-who').click();
  await userEvent.keyboard('{Backspace}');

  // Backspace is the "go back" reflex and the easiest key on the board to hit by
  // accident. Undo makes either recoverable; only one makes a designer wonder what
  // just happened.
  expect(names(designed)).toEqual(['who', 'tier']);
});

test('parity/K7-delete: the Delete key belongs to a text field first', async () => {
  const designed = surface();
  const screen = await render(<DesignSurfacePanel surface={designed} />);
  await screen.getByTestId('select-who').click();

  await screen.getByLabelText('Title of who').fill('Renamed');
  await userEvent.keyboard('{Delete}');

  // Somebody editing a title means "delete a character", not "delete the question I am
  // in the middle of naming".
  expect(names(designed)).toEqual(['who', 'tier']);
});

/**
 * Opens an element's action menu — checklist P4.
 *
 * The four verbs used to be buttons in the adorner and are now items behind one trigger,
 * so every scenario that reaches for one opens it first. The ids did not change: a
 * `duplicate-who` is the same thing it always was, which is what makes this a change of
 * shape rather than of vocabulary.
 */
async function openActions(screen: { getByTestId: (id: string) => { click: () => Promise<void> } }, name: string): Promise<void> {
  await screen.getByTestId(`actions-${name}`).click();
}
