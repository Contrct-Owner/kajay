/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface } from '@kajay/creator-core';
import { DesignSurfacePanel } from '@kajay/creator-react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/** Copy, paste, duplicate and convert — checklist K5. */
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

  // Four more controls on every question would bury the survey under the tools for
  // editing it — K3's argument for the title editor, applied to the rest.
  expect(screen.container.querySelectorAll('.kajay-designer__actions')).toHaveLength(0);

  await screen.getByTestId('select-who').click();
  expect(screen.container.querySelectorAll('.kajay-designer__actions')).toHaveLength(1);
});

test('parity/K5-duplicate: the copy lands next to the original and is selected', async () => {
  const designed = surface();
  const screen = await render(<DesignSurfacePanel surface={designed} />);
  await screen.getByTestId('select-who').click();

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

  await expect.element(screen.getByTestId('paste-who')).toBeDisabled();

  await screen.getByTestId('copy-who').click();
  await expect.element(screen.getByTestId('paste-who')).toBeEnabled();
});

test('parity/K5-paste: it lands after the selection', async () => {
  const designed = surface();
  const screen = await render(<DesignSurfacePanel surface={designed} />);
  await screen.getByTestId('select-tier').click();
  await screen.getByTestId('copy-tier').click();

  await screen.getByTestId('select-who').click();
  await screen.getByTestId('paste-who').click();

  expect(names(designed)).toEqual(['who', 'tier2', 'tier']);
});

test('parity/K5-convert: the type picker changes the question in place', async () => {
  const designed = surface();
  const screen = await render(<DesignSurfacePanel surface={designed} />);
  await screen.getByTestId('select-tier').click();

  await screen.getByLabelText('Type of tier').selectOptions('dropdown');

  // The same question, drawn by a different renderer — and its choices came with it,
  // because `choices` is a child collection the dropdown also declares.
  expect(designed.survey.getQuestionByName('tier')?.type).toBe('dropdown');
  await expect.element(screen.getByRole('combobox', { name: /Which tier/u })).toBeInTheDocument();
  expect(names(designed)).toEqual(['who', 'tier']);
});

test('parity/K5-convert: the picker shows what the question is now', async () => {
  const designed = surface();
  const screen = await render(<DesignSurfacePanel surface={designed} />);
  await screen.getByTestId('select-tier').click();

  await expect.element(screen.getByLabelText('Type of tier')).toHaveValue('radiogroup');
});
