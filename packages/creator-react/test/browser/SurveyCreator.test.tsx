/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { SurveyCreator } from '@kajay/creator-react';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

/** The default assembly — checklist N1. */
const BASIC: SurveyDefinition = {
  pages: [{ name: 'p1', elements: [{ type: 'text', name: 'who', title: 'Your name' }] }],
};

function registry(): MetadataRegistry {
  const made = new MetadataRegistry();
  registerBuiltInTypes(made);
  return made;
}

function noop(): void {}

test('parity/N1-assembly: every tab is reachable, and one is on at a time', async () => {
  const screen = await render(<SurveyCreator value={BASIC} registry={registry()} />);

  // A preview is a complete second survey in the document, so showing it beside the
  // designer makes every page-wide query ambiguous — M3 found that the expensive way.
  await expect.element(screen.getByTestId('select-who')).toBeInTheDocument();
  await expect
    .element(screen.getByTestId('creator-tab-design'))
    .toHaveAttribute('aria-current', 'page');
  // One at a time: the other tabs are not merely hidden, they are not drawn. A preview
  // rendered beside the designer is a second survey in the document.
  expect(screen.container.querySelector('#kajay-json-text')).toBeNull();
  expect(screen.container.querySelector('[data-testid="preview-frame"]')).toBeNull();

  await screen.getByTestId('creator-tab-json').click();
  await expect.element(screen.getByLabelText('Survey definition')).toBeInTheDocument();
  expect(screen.container.querySelector('[data-testid="select-who"]')).toBeNull();

  await screen.getByTestId('creator-tab-logic').click();
  await expect.element(screen.getByLabelText('What the new rule does')).toBeInTheDocument();
});

test('parity/N1-controlled: an edit is reported once, as a definition', async () => {
  const onChange = vi.fn();
  const screen = await render(
    <SurveyCreator value={BASIC} onChange={onChange} registry={registry()} />,
  );

  await screen.getByTestId('select-who').click();
  await screen.getByLabelText('Title of who').fill('Renamed');
  // P10 commits on blur, so the host hears about it when the designer is done rather than
  // once per keystroke — which is also what makes it one entry on the undo stack.
  await screen.getByTestId('creator-tab-design').click();

  const last = onChange.mock.lastCall?.[0] as SurveyDefinition;
  expect(JSON.stringify(last)).toContain('Renamed');
});

/** A host holding the value in state, which is what "controlled" means to one. */
function Controlled({ onChange }: { readonly onChange: (json: string) => void }): ReactElement {
  const [value, setValue] = useState<SurveyDefinition>(BASIC);

  return (
    <>
      <SurveyCreator
        value={value}
        registry={registry()}
        onChange={(next) => {
          setValue(next);
          onChange(JSON.stringify(next));
        }}
      />
      <button
        type="button"
        data-testid="push-new-document"
        onClick={() => {
          setValue({ pages: [{ name: 'other', elements: [{ type: 'comment', name: 'notes' }] }] });
        }}
      >
        Load another survey
      </button>
    </>
  );
}

test('parity/N1-controlled: the Creator’s own output coming back is not a change', async () => {
  const onChange = vi.fn();
  const screen = await render(<Controlled onChange={onChange} />);

  await screen.getByTestId('select-who').click();
  await screen.getByLabelText('Title of who').fill('Renamed');
  await screen.getByTestId('creator-tab-design').click();

  // The host echoed every change straight back. Without the "is this our own output"
  // check, the editor would re-open itself on every edit — losing the selection and
  // filling the undo stack with its own output.
  //
  // `toHaveTextContent`, not `toHaveValue`: the editor is the text itself now, and text
  // has no value attribute.
  await expect.element(screen.getByLabelText('Title of who')).toHaveTextContent('Renamed');
  await expect.element(screen.getByTestId('select-who')).toBeInTheDocument();
});

test('parity/N1-controlled: a value the host means is opened', async () => {
  const screen = await render(<Controlled onChange={noop} />);

  await screen.getByTestId('push-new-document').click();

  await expect.element(screen.getByTestId('select-notes')).toBeInTheDocument();
  expect(screen.container.querySelector('[data-testid="select-who"]')).toBeNull();

  // Through `applyEdit`, so a host pushing a document in is an edit a designer can take
  // back rather than a reset that throws their history away.
  await screen.getByTestId('undo').click();
  await expect.element(screen.getByTestId('select-who')).toBeInTheDocument();
});

test('parity/N1-save: the button saves, and says what happened', async () => {
  const save = vi.fn(() => true);
  const screen = await render(<SurveyCreator value={BASIC} save={save} registry={registry()} />);

  await screen.getByTestId('creator-save').click();

  expect(save).toHaveBeenCalledTimes(1);
  await expect
    .element(screen.getByTestId('creator-save-state'))
    .toHaveAttribute('data-state', 'saved');
});

test('parity/N1-save: a failure is said rather than shown as success', async () => {
  const screen = await render(
    <SurveyCreator value={BASIC} save={() => false} registry={registry()} />,
  );

  await screen.getByTestId('creator-save').click();

  // A save that quietly did not happen is the one thing a designer must never have to
  // guess about, so it is in a live region as well as on the button.
  await expect
    .element(screen.getByTestId('creator-save-state'))
    .toHaveTextContent('Save failed — try again');
});

test('parity/N1-save: auto-save saves an edit without being asked', async () => {
  const save = vi.fn(() => true);
  const screen = await render(
    <SurveyCreator value={BASIC} save={save} isAutoSave registry={registry()} />,
  );

  await screen.getByTestId('select-who').click();
  await screen.getByLabelText('Title of who').fill('Renamed');

  await expect
    .element(screen.getByTestId('creator-save-state'))
    .toHaveAttribute('data-state', 'saved');
  expect(save.mock.calls.length).toBeGreaterThan(0);
});

test('parity/N1-save: no saver means no save button', async () => {
  const screen = await render(<SurveyCreator value={BASIC} registry={registry()} />);

  expect(screen.container.querySelector('[data-testid="creator-save"]')).toBeNull();
});
