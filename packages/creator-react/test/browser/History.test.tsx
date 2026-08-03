/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface, Toolbox } from '@kajay/creator-core';
import {
  DesignSurfacePanel,
  HistoryPanel,
  ToolboxPanel,
  historyShortcut,
  useDesignerPlacement,
} from '@kajay/creator-react';
import { userEvent } from '@vitest/browser/context';
import type { ReactElement } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/** Undo and redo — checklist K6. */
const BASIC: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'who', title: 'Your name' },
        { type: 'text', name: 'why', title: 'Why?' },
      ],
    },
  ],
};

function surface(): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition: BASIC, registry });
}

function Harness({ designed }: { readonly designed: DesignSurface }): ReactElement {
  const placement = useDesignerPlacement(designed);
  return (
    <>
      <HistoryPanel surface={designed} />
      <ToolboxPanel toolbox={new Toolbox()} getItemProps={placement.getItemProps} />
      <DesignSurfacePanel surface={designed} placement={placement} />
    </>
  );
}

function names(designed: DesignSurface): readonly string[] {
  return (designed.page?.elements ?? []).map((element) => element.name);
}

test('parity/K6-buttons: they say whether there is anything to undo', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);

  // `Ctrl+Z` on an empty stack does nothing and looks exactly like `Ctrl+Z` on a broken
  // one. A button can say which it is.
  await expect.element(screen.getByTestId('undo')).toBeDisabled();
  await expect.element(screen.getByTestId('redo')).toBeDisabled();

  await screen.getByTestId('toolbox-comment').click();
  await expect.element(screen.getByTestId('undo')).toBeEnabled();
  await expect.element(screen.getByTestId('redo')).toBeDisabled();
});

test('parity/K6-buttons: undo then redo', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);
  await screen.getByTestId('toolbox-comment').click();

  await screen.getByTestId('undo').click();
  expect(names(designed)).toEqual(['who', 'why']);
  await expect.element(screen.getByTestId('redo')).toBeEnabled();

  await screen.getByTestId('redo').click();
  expect(names(designed)).toEqual(['who', 'why', 'comment1']);
});

test('parity/K6-shortcut: Ctrl+Z on the canvas undoes', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);
  await screen.getByTestId('toolbox-comment').click();

  // Focus has to be inside the canvas, which is where the binding lives — the library
  // does not attach a document listener, because that would take Ctrl+Z away from the
  // rest of a host's application.
  await screen.getByTestId('select-who').click();
  await userEvent.keyboard('{Control>}z{/Control}');

  expect(names(designed)).toEqual(['who', 'why']);
});

test('parity/K6-shortcut: Ctrl+Shift+Z redoes', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);
  await screen.getByTestId('toolbox-comment').click();
  await screen.getByTestId('select-who').click();
  await userEvent.keyboard('{Control>}z{/Control}');

  await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');

  expect(names(designed)).toEqual(['who', 'why', 'comment1']);
});

test('parity/K6-shortcut: inside a text field it belongs to the field', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);
  await screen.getByTestId('toolbox-comment').click();

  await screen.getByTestId('select-who').click();
  await screen.getByLabelText('Title of who').fill('Renamed');
  await userEvent.keyboard('{Control>}z{/Control}');

  // Somebody mid-rename means "take back that letter", not "roll back the drop I made
  // before I started typing" — and the letters they typed are on no stack of ours.
  expect(names(designed)).toEqual(['who', 'why', 'comment1']);
});

test('parity/K6-shortcut: both spellings of redo are accepted', () => {
  const held = { ctrlKey: true, metaKey: false, shiftKey: false };

  // Ctrl+Y is the Windows convention and Ctrl+Shift+Z is everywhere else. Taking one
  // and refusing the other makes redo feel broken to half the people who try it.
  expect(historyShortcut({ ...held, key: 'y' })).toBe('redo');
  expect(historyShortcut({ ...held, key: 'z', shiftKey: true })).toBe('redo');
  expect(historyShortcut({ ...held, key: 'z' })).toBe('undo');
  expect(historyShortcut({ ...held, key: 'Z', metaKey: true, ctrlKey: false })).toBe('undo');
  expect(historyShortcut({ ...held, key: 'z', ctrlKey: false })).toBeUndefined();
  expect(historyShortcut({ ...held, key: 'a' })).toBeUndefined();
});
