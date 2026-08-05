/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface } from '@kajay/creator-core';
import { DesignSurfacePanel } from '@kajay/creator-react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/** Editing the words where they sit — checklist P10. */
const BASIC: SurveyDefinition = {
  pages: [{ name: 'p1', elements: [{ type: 'text', name: 'who', title: 'Your name' }] }],
};

function surface(definition: SurveyDefinition = BASIC): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition, registry });
}

test('parity/P10-inline: the title on the canvas is the editor', async () => {
  const designed = surface();
  const screen = await render(<DesignSurfacePanel surface={designed} />);

  const title = screen.getByTestId('inline-title-who');
  await expect.element(title).toHaveTextContent('Your name');

  // The adorner's separate input is gone: K3 had a designer read the title in one place
  // and type it in another.
  expect(screen.container.querySelector('.kajay-designer__title')).toBeNull();
});

test('parity/P10-inline: it commits on blur, not on every keystroke', async () => {
  const designed = surface();
  const screen = await render(<DesignSurfacePanel surface={designed} />);
  const node = screen.container.querySelector('[data-testid="inline-title-who"]') as HTMLElement;

  node.focus();
  node.textContent = 'What is your name?';

  // **Still the old title.** Every edit re-parses the definition, so writing per character
  // would re-parse the survey per character and tear the caret out of the node being typed
  // in — and would make one rename twelve undo entries.
  expect(designed.survey.getQuestionByName('who')?.title).toBe('Your name');

  node.blur();
  await expect.poll(() => designed.survey.getQuestionByName('who')?.title).toBe(
    'What is your name?',
  );
});

test('parity/P10-inline: Escape abandons what was typed', async () => {
  const designed = surface();
  const screen = await render(<DesignSurfacePanel surface={designed} />);
  const node = screen.container.querySelector('[data-testid="inline-title-who"]') as HTMLElement;

  node.focus();
  node.textContent = 'half a thought';
  node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  await expect.poll(() => node.textContent).toBe('Your name');
  expect(designed.survey.getQuestionByName('who')?.title).toBe('Your name');
});

test('parity/P10-inline: typing on a question selects it', async () => {
  const designed = surface();
  const screen = await render(<DesignSurfacePanel surface={designed} />);
  const node = screen.container.querySelector('[data-testid="inline-title-who"]') as HTMLElement;

  node.focus();

  // Editing the words of something while the grid showed something else would be two
  // different answers to "what am I working on".
  await expect.poll(() => designed.selected?.getPropertyValue('name')).toBe('who');
});

test('parity/P10-inline: a panel’s title and description are editable in place', async () => {
  const designed = surface({
    pages: [
      {
        name: 'p1',
        elements: [
          {
            type: 'panel',
            name: 'about',
            title: 'About you',
            description: 'A few details.',
            elements: [{ type: 'text', name: 'who', title: 'Your name' }],
          },
        ],
      },
    ],
  });
  const screen = await render(<DesignSurfacePanel surface={designed} />);

  const description = screen.container.querySelector(
    '[data-testid="inline-description-about"]',
  ) as HTMLElement;
  description.focus();
  description.textContent = 'Tell us who you are.';
  description.blur();

  await expect.poll(() => designed.definition['pages']).toBeDefined();
  expect(JSON.stringify(designed.definition)).toContain('Tell us who you are.');

  // The panel's title too — a container is named for the people reading it, and until now
  // that name could only be changed in the grid.
  await expect
    .element(screen.getByTestId('inline-title-about'))
    .toHaveTextContent('About you');
});

const CHOICES = {
  pages: [
    {
      name: 'p1',
      elements: [
        {
          type: 'radiogroup',
          name: 'mood',
          title: 'How was it?',
          choices: [{ value: 'great', text: 'Great' }, 'fine'],
        },
      ],
    },
  ],
};

function editChoice(screen: { container: Element }, key: string, typed: string): void {
  const node = screen.container.querySelector(
    `[data-testid="inline-choices-${key}"]`,
  ) as HTMLElement;
  node.focus();
  node.textContent = typed;
  node.blur();
}

test('parity/P10-choices: editing a label never touches the answer key', async () => {
  const designed = surface(CHOICES);
  const screen = await render(<DesignSurfacePanel surface={designed} />);

  editChoice(screen, 'great', 'Absolutely great');

  // **The sharpest risk in the whole row.** `value` is what every collected response is
  // already stored under; fixing a typo in what a respondent reads must not silently
  // invalidate data. Changing the key stays a deliberate act in the property grid.
  await expect.poll(() => JSON.stringify(designed.definition)).toContain('Absolutely great');
  const choices = designed.definition['pages'] as unknown as string;
  expect(JSON.stringify(choices)).toContain('"value":"great"');
});

test('parity/P10-choices: a label equal to its value stays bare', async () => {
  const designed = surface(CHOICES);
  const screen = await render(<DesignSurfacePanel surface={designed} />);

  // `fine` was authored bare. Typing the same word back must not grow a redundant `text`,
  // or the round-trip output changes shape because somebody clicked on it.
  editChoice(screen, 'fine', 'fine');

  await expect.poll(() => JSON.stringify(designed.definition)).not.toContain('"text":"fine"');
});
