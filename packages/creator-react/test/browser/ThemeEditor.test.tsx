/// <reference types="@vitest/browser/matchers" />
import { ThemeEditorSession } from '@kajay/creator-core';
import type { ThemeDocument } from '@kajay/creator-core';
import { ThemeEditorPanel } from '@kajay/creator-react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/** The theme editor — checklist M5. */
const BASIC: ThemeDocument = {
  name: 'demo',
  palette: { accent: '#3355ff' },
  size: 'regular',
};

test('parity/M5-theme-editing: a field writes into the theme', async () => {
  const session = new ThemeEditorSession({ theme: BASIC });
  const screen = await render(<ThemeEditorPanel session={session} />);

  await screen.getByLabelText('Corner radius').fill('12px');

  expect(session.theme['cornerRadius']).toBe('12px');
});

test('parity/M5-theme-editing: what the theme does not name is drawn as unset', async () => {
  const session = new ThemeEditorSession({ theme: BASIC });
  const screen = await render(<ThemeEditorPanel session={session} />);

  // A different answer from "empty": an absent field leaves the stylesheet's own default
  // alone (I2), so a designer has to be able to tell the two apart.
  const isSet = (): string | undefined =>
    screen.container
      .querySelector<HTMLElement>('[data-testid="theme-cornerRadius"]')
      ?.closest<HTMLElement>('.kajay-theme__row')?.dataset['set'];

  expect(isSet()).toBeUndefined();

  await screen.getByLabelText('Corner radius').fill('12px');
  expect(isSet()).toBe('true');
});

test('parity/M5-theme-editing: clearing a field removes it rather than blanking it', async () => {
  const session = new ThemeEditorSession({ theme: BASIC });
  const screen = await render(<ThemeEditorPanel session={session} />);

  // Exact, or it also matches "On accent" — which is itself the reason that field has
  // its own entry rather than being derived from the accent.
  await screen.getByLabelText('Accent', { exact: true }).fill('');

  // A blanked variable would override the stylesheet's default with nothing.
  expect(session.theme['palette']).toBeUndefined();
});

test('parity/M5-theme-editing: a choice can be put back to unset', async () => {
  const session = new ThemeEditorSession({ theme: BASIC });
  const screen = await render(<ThemeEditorPanel session={session} />);

  await expect.element(screen.getByLabelText('Size')).toHaveValue('regular');
  await screen.getByLabelText('Size').selectOptions('');

  // Without the empty option a choice, once made, could never be taken back.
  expect(session.theme['size']).toBeUndefined();
});

test('parity/M5-theme-fields: a colour is shown as well as spelled', async () => {
  const session = new ThemeEditorSession({ theme: BASIC });
  const screen = await render(<ThemeEditorPanel session={session} />);

  // A swatch rather than `<input type="color">`, which accepts `#rrggbb` and nothing else
  // — a theme is free to hold `oklch(…)` or a `var(…)` reference.
  const swatch = screen.getByTestId('theme-swatch-palette.accent').element() as HTMLElement;
  expect(swatch.style.background).toContain('rgb(51, 85, 255)');
});

test('parity/M5-theme-fields: a key the table has never heard of is editable', async () => {
  const session = new ThemeEditorSession({ theme: { palette: { highlight: '#ff0' } } });
  const screen = await render(<ThemeEditorPanel session={session} />);

  await expect.element(screen.getByLabelText('Highlight')).toHaveValue('#ff0');
});

test('parity/M5-theme-file: reset goes back, and a bad file is reported', async () => {
  const session = new ThemeEditorSession({ theme: BASIC });
  const screen = await render(<ThemeEditorPanel session={session} />);

  await expect.element(screen.getByTestId('theme-reset')).toBeDisabled();
  await screen.getByLabelText('Corner radius').fill('12px');
  await expect.element(screen.getByTestId('theme-reset')).toBeEnabled();

  session.applyJson('[1, 2, 3]');
  await expect.element(screen.getByTestId('theme-problem')).toHaveTextContent(
    'A theme must be a JSON object.',
  );

  await screen.getByTestId('theme-reset').click();
  await expect.element(screen.getByLabelText('Corner radius')).toHaveValue('');
});
