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

  const title = screen.getByLabelText('Title of who');
  await title.fill('What is your name?');
  // **Blurred, because P10 commits on blur.** Writing per keystroke would re-parse the
  // definition per character and pull the caret out of the node being typed in.
  await screen.getByRole('button', { name: 'Select who' }).click();

  // The title on the canvas *is* the editor now, so the words a respondent will read and
  // the words the designer typed are the same node.
  await expect.element(screen.getByLabelText('What is your name?')).toBeInTheDocument();
  expect(JSON.stringify(serializeSurvey(designed.survey))).toContain('What is your name?');
});

test('parity/P10-inline: every title is editable, and typing on one selects it', async () => {
  const designed = surface();
  const screen = await render(<DesignSurfacePanel surface={designed} />);

  // **The editor is no longer gated on selection**, which is the point of the change. K3's
  // adorner input only existed on the selected element, so renaming a question was two
  // gestures: select it, then find the box. The words are the box now, on every element.
  expect(screen.container.querySelectorAll('.kajay-inline').length).toBeGreaterThan(1);
  expect(designed.selected).toBeUndefined();

  const node = screen.container.querySelector(
    '[data-testid="inline-title-plan"]',
  ) as HTMLElement;
  node.focus();

  // Selecting on focus is what keeps the property grid honest: editing the words of one
  // question while the grid showed another would be two answers to "what am I working on".
  await expect.poll(() => designed.selected?.getPropertyValue('name')).toBe('plan');
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

  // **And the page's own column count, which had been missing.** The canvas *is* the
  // page's grid and the stylesheet had always read this variable from it, but only
  // `SurveyPage` ever wrote one — so a two-column page was drawn in one column and the
  // assertions above passed anyway, because both are about an element rather than the
  // grid it sits in. Found by a scenario about where a drop lands: a placeholder that
  // takes a cell has nothing to say on a surface that only ever has one.
  const designer = screen.container.querySelector<HTMLElement>('.kajay-designer')!;
  expect(designer.style.getPropertyValue('--kajay-col-count')).toBe('2');
});

test('parity/K3-design-surface: a survey with no pages says so', async () => {
  const screen = await render(<DesignSurfacePanel surface={surface({})} />);

  await expect.element(screen.getByRole('status')).toHaveTextContent('no pages yet');
});

test('parity/K3-chip: the chip says the name, selected or not', async () => {
  const designed = surface();
  const screen = await render(<DesignSurfacePanel surface={designed} />);

  // It used to say the type until you clicked, and the name afterwards. A chip that means
  // one thing until you select and another after is a worse label than either — a designer
  // tracking an element watches the word change under them. Nothing pinned it either way,
  // which is why it drifted.
  const chip = screen.getByTestId('select-plan');
  await expect.element(chip).toHaveTextContent('plan');

  await chip.click();
  await expect.element(screen.getByTestId('select-plan')).toHaveTextContent('plan');
});
