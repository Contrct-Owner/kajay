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
