/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface, PreviewSession } from '@kajay/creator-core';
import { PreviewPanel } from '@kajay/creator-react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/** Running the survey being designed — checklist M3. */
const BASIC: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'who', title: 'Your name' },
        { type: 'text', name: 'why', title: 'Why?', visibleIf: "{who} = 'ada'" },
      ],
    },
  ],
};

/**
 * The frame's *inline* width, which is what the panel sets.
 *
 * Not `toHaveStyle`, which compares the computed value: a block element with no width
 * declared computes to whatever it was laid out at, so "responsive states no width" and
 * "responsive is 1280px wide" are indistinguishable through it — and the first is the
 * claim.
 */
function frameWidth(element: Element): string {
  return (element as HTMLElement).style.width;
}

function surface(): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition: BASIC, registry });
}

test('parity/M3-preview: the survey inside is answerable, unlike the canvas', async () => {
  const designed = surface();
  const preview = new PreviewSession(designed);
  const screen = await render(<PreviewPanel session={preview} />);

  await screen.getByLabelText('Your name').fill('ada');

  // The real `<Survey>`, with no design-mode flag — so it answers, and the logic the
  // designer just wrote runs against the answer.
  expect(preview.data['who']).toBe('ada');
  await expect.element(screen.getByLabelText('Why?')).toBeInTheDocument();
  preview.dispose();
});

test('parity/M3-preview-devices: a preset is a real width on the frame', async () => {
  const designed = surface();
  const preview = new PreviewSession(designed);
  const screen = await render(<PreviewPanel session={preview} />);

  // Responsive fills what it is given, so the frame states no width at all.
  expect(frameWidth(screen.getByTestId('preview-frame').element())).toBe('');

  await screen.getByLabelText('Preview device').selectOptions('phone');

  expect(frameWidth(screen.getByTestId('preview-frame').element())).toBe('375px');
  preview.dispose();
});

test('parity/M3-preview-devices: rotating swaps the two numbers', async () => {
  const designed = surface();
  const preview = new PreviewSession(designed, { device: 'phone' });
  const screen = await render(<PreviewPanel session={preview} />);

  await screen.getByTestId('preview-rotate').click();

  expect(frameWidth(screen.getByTestId('preview-frame').element())).toBe('667px');
  // Pressed rather than a label that changes: a button reading "Landscape" is ambiguous
  // about whether that is what it is or what it would do.
  await expect.element(screen.getByTestId('preview-rotate')).toHaveAttribute('aria-pressed', 'true');
  preview.dispose();
});

test('parity/M3-preview-devices: changing the device disturbs nothing', async () => {
  const designed = surface();
  const preview = new PreviewSession(designed);
  const screen = await render(<PreviewPanel session={preview} />);
  const field = screen.getByLabelText('Your name').element();
  await screen.getByLabelText('Your name').fill('ada');
  (field as HTMLInputElement).focus();

  await screen.getByLabelText('Preview device').selectOptions('phone');

  // Throwing away a half-filled run to look at it on a phone would make the one question
  // the preset exists to answer the hardest one to ask. **Asserted on focus**, not on the
  // value: the value comes back from the model on a remount, so it cannot tell a redraw
  // from a fresh run — the caret is the thing a remount actually destroys, which is why
  // the survey is keyed on the run rather than on the version.
  await expect.element(screen.getByLabelText('Your name')).toHaveValue('ada');
  expect(document.activeElement).toBe(field);
  preview.dispose();
});

test('parity/M3-preview: typing does not remount the survey underneath the caret', async () => {
  const designed = surface();
  const preview = new PreviewSession(designed);
  const screen = await render(<PreviewPanel session={preview} />);
  const field = screen.getByLabelText('Your name').element();
  (field as HTMLInputElement).focus();

  // The first answer flips `isTouched`, which advances the version. Keying on that would
  // tear the field out from under somebody the moment they typed into it.
  await screen.getByLabelText('Your name').fill('a');

  expect(document.activeElement).toBe(field);
  preview.dispose();
});

test('parity/M3-preview-follows: an untouched run follows an edit silently', async () => {
  const designed = surface();
  const preview = new PreviewSession(designed);
  const screen = await render(<PreviewPanel session={preview} />);

  designed.setProperty(designed.survey.getQuestionByName('who')!, 'title', 'Name');

  await expect.element(screen.getByLabelText('Name')).toBeInTheDocument();
  expect(screen.container.querySelector('[data-testid="preview-stale"]')).toBeNull();
  preview.dispose();
});

test('parity/M3-preview-follows: a touched run says so and keeps what was typed', async () => {
  const designed = surface();
  const preview = new PreviewSession(designed);
  const screen = await render(<PreviewPanel session={preview} />);
  await screen.getByLabelText('Your name').fill('ada');

  designed.setProperty(designed.survey.getQuestionByName('who')!, 'title', 'Name');

  await expect.element(screen.getByTestId('preview-stale')).toBeInTheDocument();
  await expect.element(screen.getByLabelText('Your name')).toHaveValue('ada');

  await screen.getByTestId('preview-restart').click();

  await expect.element(screen.getByLabelText('Name')).toHaveValue('');
  expect(screen.container.querySelector('[data-testid="preview-stale"]')).toBeNull();
  preview.dispose();
});
