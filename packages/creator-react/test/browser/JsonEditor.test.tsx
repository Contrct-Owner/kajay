/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface, JsonEditorSession } from '@kajay/creator-core';
import { JsonEditorPanel } from '@kajay/creator-react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/** The definition as text — checklist M2. */
const BASIC: SurveyDefinition = {
  pages: [{ name: 'p1', elements: [{ type: 'text', name: 'who', title: 'Your name' }] }],
};

function surface(): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition: BASIC, registry });
}

test('parity/M2-json-sync: the editor opens on the designer’s own definition', async () => {
  const designed = surface();
  const editor = new JsonEditorSession(designed);
  const screen = await render(<JsonEditorPanel session={editor} />);

  await expect.element(screen.getByLabelText('Survey definition')).toHaveValue(editor.text);
  // Nothing to apply and nothing to throw away until somebody types.
  await expect.element(screen.getByTestId('json-apply')).toBeDisabled();
  await expect.element(screen.getByTestId('json-revert')).toBeDisabled();
  editor.dispose();
});

test('parity/M2-json-sync: applying reaches the designer', async () => {
  const designed = surface();
  const editor = new JsonEditorSession(designed);
  const screen = await render(<JsonEditorPanel session={editor} />);

  await screen
    .getByLabelText('Survey definition')
    .fill('{"pages":[{"name":"p1","elements":[{"type":"comment","name":"notes"}]}]}');
  await screen.getByTestId('json-apply').click();

  expect(designed.survey.getQuestionByName('notes')?.type).toBe('comment');
  await expect.element(screen.getByTestId('json-apply')).toBeDisabled();
});

test('parity/M2-json-sync: a clean draft follows the designer', async () => {
  const designed = surface();
  const editor = new JsonEditorSession(designed);
  const screen = await render(<JsonEditorPanel session={editor} />);

  designed.setProperty(designed.survey.getQuestionByName('who')!, 'title', 'Name');

  await expect.element(screen.getByLabelText('Survey definition')).toHaveValue(
    expect.stringContaining('"title": "Name"') as unknown as string,
  );
  expect(screen.container.querySelector('[data-testid="json-stale"]')).toBeNull();
  editor.dispose();
});

test('parity/M2-json-sync: a dirty draft is kept, and the conflict is said', async () => {
  const designed = surface();
  const editor = new JsonEditorSession(designed);
  const screen = await render(<JsonEditorPanel session={editor} />);
  await screen.getByLabelText('Survey definition').fill('{"pages":[]}');

  designed.setProperty(designed.survey.getQuestionByName('who')!, 'title', 'Name');

  await expect.element(screen.getByTestId('json-stale')).toBeInTheDocument();
  await expect.element(screen.getByLabelText('Survey definition')).toHaveValue('{"pages":[]}');

  await screen.getByTestId('json-revert').click();
  expect(screen.container.querySelector('[data-testid="json-stale"]')).toBeNull();
  editor.dispose();
});

test('parity/M2-json-errors: a syntax error is shown and blocks applying', async () => {
  const designed = surface();
  const editor = new JsonEditorSession(designed);
  const screen = await render(<JsonEditorPanel session={editor} />);

  await screen.getByLabelText('Survey definition').fill('{\n"pages":[]\n"x":1\n}');

  await expect.element(screen.getByTestId('json-problem')).toHaveTextContent('Line 3, column 1');
  await expect.element(screen.getByLabelText('Survey definition')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect.element(screen.getByTestId('json-apply')).toBeDisabled();
  editor.dispose();
});

test('parity/M2-json-errors: a diagnostic is shown with its pointer and does not block', async () => {
  const designed = surface();
  const editor = new JsonEditorSession(designed);
  const screen = await render(<JsonEditorPanel session={editor} />);

  await screen
    .getByLabelText('Survey definition')
    .fill('{"pages":[{"name":"p1","elements":[{"type":"text","name":"who","nonsense":1}]}]}');

  // Refusing here would make this tab stricter than the file the host loaded at startup.
  await expect.element(screen.getByTestId('json-diagnostics')).toHaveTextContent(
    '/pages/0/elements/0',
  );
  await expect.element(screen.getByTestId('json-apply')).toBeEnabled();
  editor.dispose();
});
