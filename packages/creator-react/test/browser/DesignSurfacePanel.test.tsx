/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes, serializeSurvey } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface } from '@kajay/creator-core';
import { DesignSurfacePanel } from '@kajay/creator-react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * The design surface — checklist K3.
 *
 * The questions on screen are drawn by the same renderers a respondent gets, which is
 * the claim worth testing here: nothing in the Creator knows what a radio group is.
 */
const BASIC: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'who', title: 'Your name' },
        { type: 'radiogroup', name: 'plan', title: 'Which plan?', choices: ['free', 'paid'] },
      ],
    },
  ],
};

function surface(definition: SurveyDefinition = BASIC): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition, registry });
}

test('parity/K3-design-surface: it draws the real questions', async () => {
  const screen = await render(<DesignSurfacePanel surface={surface()} />);

  // The respondent's renderers, not a drawing of them: the radio group has real radios
  // with real accessible names, and no code in the Creator knows what a radio group is.
  await expect.element(screen.getByLabelText('Your name')).toBeInTheDocument();
  await expect.element(screen.getByRole('radio', { name: 'free' })).toBeInTheDocument();
  await expect.element(screen.getByRole('radio', { name: 'paid' })).toBeInTheDocument();
});

test('parity/K3-selection: clicking an element selects it', async () => {
  const designed = surface();
  const screen = await render(<DesignSurfacePanel surface={designed} />);

  await screen.getByRole('radio', { name: 'free' }).click();

  // Clicking a radio in the designer means "select this question", never "answer it".
  // The refusal is E7's, through design mode, and it is visible in the markup rather
  // than resting on a `preventDefault` racing the browser's default action.
  expect(designed.selected?.getPropertyValue('name')).toBe('plan');
  expect(designed.survey.getValue('plan')).toBeUndefined();
  expect(
    screen.container.querySelector('[data-question-name="plan"]')?.getAttribute('aria-readonly'),
  ).toBe('true');
});

test('parity/K3-selection: it is reachable without a pointer', async () => {
  const designed = surface();
  const screen = await render(<DesignSurfacePanel surface={designed} />);

  // A click is not a keyboard, so the adorner carries a real button. Without it the
  // surface would be selectable only with a mouse.
  await screen.getByRole('button', { name: 'Select who' }).click();

  expect(designed.selected?.getPropertyValue('name')).toBe('who');
  expect(
    screen.container.querySelector<HTMLElement>('[data-element-type="text"]')?.dataset['selected'],
  ).toBe('true');
});

test('parity/K3-selection: clicking the background clears it', async () => {
  const designed = surface();
  const screen = await render(<DesignSurfacePanel surface={designed} />);
  await screen.getByRole('button', { name: 'Select who' }).click();

  await screen.getByRole('button', { name: 'Select who' }).click();
  const panel = screen.container.querySelector('.kajay-designer');
  panel?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  // The only way out of a selection without picking something else.
  await expect.poll(() => designed.selected).toBeUndefined();
});

test('parity/K3-inline-title: editing the title updates the rendered question', async () => {
  const designed = surface();
  const screen = await render(<DesignSurfacePanel surface={designed} />);
  await screen.getByRole('button', { name: 'Select who' }).click();

  await screen.getByLabelText('Title of who').fill('What is your name?');

  // The editor is in the adorner and the question keeps its own title, so a designer
  // sees the label a respondent will read updating as they type.
  await expect.element(screen.getByLabelText('What is your name?')).toBeInTheDocument();
  expect(JSON.stringify(serializeSurvey(designed.survey))).toContain('What is your name?');
});

test('parity/K3-inline-title: the editor only appears on the selected element', async () => {
  const screen = await render(<DesignSurfacePanel surface={surface()} />);

  expect(screen.container.querySelectorAll('.kajay-designer__title')).toHaveLength(0);
  await screen.getByRole('button', { name: 'Select plan' }).click();
  expect(screen.container.querySelectorAll('.kajay-designer__title')).toHaveLength(1);
});

test('parity/K3-design-surface: elements keep the layout they will have', async () => {
  const designed = surface({
    pages: [
      {
        name: 'p1',
        colCount: 2,
        elements: [
          { type: 'text', name: 'first', title: 'First' },
          { type: 'text', name: 'second', title: 'Second', startWithNewLine: true },
        ],
      },
    ],
  });
  const screen = await render(<DesignSurfacePanel surface={designed} />);

  // The renderer's own layout wrapper, not a second copy of it: `startWithNewLine`
  // means here exactly what it will mean to a respondent (I5).
  const slots = screen.container.querySelectorAll('.kajay-element');
  expect((slots[0] as HTMLElement).style.gridColumnStart).toBe('');
  expect((slots[1] as HTMLElement).style.gridColumnStart).toBe('1');
});

test('parity/K3-design-surface: a survey with no pages says so', async () => {
  const screen = await render(<DesignSurfacePanel surface={surface({})} />);

  await expect.element(screen.getByRole('status')).toHaveTextContent('no pages yet');
});
