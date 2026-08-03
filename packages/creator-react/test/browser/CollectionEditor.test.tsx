/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { childrenIn, DesignSurface } from '@kajay/creator-core';
import { PropertyGridPanel } from '@kajay/creator-react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/** The choices editor and the validators editor — checklist L2. */
const BASIC: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        {
          type: 'radiogroup',
          name: 'tier',
          title: 'Which tier?',
          choices: ['bronze', { value: 'silver', text: 'Silver' }],
        },
      ],
    },
  ],
};

function surface(): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  const designed = new DesignSurface({ definition: BASIC, registry });
  const tier = designed.survey.getQuestionByName('tier');
  if (tier !== undefined) {
    designed.select(tier);
  }
  return designed;
}

function choices(designed: DesignSurface): readonly unknown[] {
  return (childrenIn(designed.definition, 'tier', 'choices') ?? []).map((child) => child['value']);
}

test('parity/L2-collections: a choice list and a validator list are both drawn', async () => {
  const designed = surface();
  const screen = await render(<PropertyGridPanel surface={designed} />);

  await expect.element(screen.getByTestId('collection-choices')).toBeInTheDocument();
  await expect.element(screen.getByTestId('collection-validators')).toBeInTheDocument();
  // A choice is always an `itemvalue`, so there is nothing to pick between; a validator
  // has seven concrete subclasses, so there is.
  expect(screen.container.querySelector('[data-testid="add-type-choices"]')).toBeNull();
  await expect.element(screen.getByTestId('add-type-validators')).toBeInTheDocument();
});

test('parity/L2-collections: a choice is edited by the same grid as its question', async () => {
  const designed = surface();
  const screen = await render(<PropertyGridPanel surface={designed} />);

  // Collapsed by default: a choice list showing four properties per choice buries the
  // list itself.
  await screen.getByTestId('open-choices-0').click();
  // Scoped: the question has a `Visible if` too, and so does every choice in it. The ids
  // carry the owner, which is what stops the labels pointing at each other.
  await screen
    .getByTestId('collection-choices')
    .getByLabelText('Text', { exact: true })
    .first()
    .fill('Bronze tier');

  expect(childrenIn(designed.definition, 'tier', 'choices')?.[0]?.['text']).toBe('Bronze tier');
});

test('parity/L2-collections: adding, removing and reordering', async () => {
  const designed = surface();
  const screen = await render(<PropertyGridPanel surface={designed} />);

  await screen.getByTestId('add-choices').click();
  expect(choices(designed)).toEqual(['bronze', 'silver', 'value1']);

  await screen.getByTestId('move-down-choices-0').click();
  expect(choices(designed)).toEqual(['silver', 'bronze', 'value1']);

  await screen.getByTestId('remove-choices-2').click();
  expect(choices(designed)).toEqual(['silver', 'bronze']);
});

test('parity/L2-collections: the ends of the list cannot be moved past', async () => {
  const designed = surface();
  const screen = await render(<PropertyGridPanel surface={designed} />);

  await expect.element(screen.getByTestId('move-up-choices-0')).toBeDisabled();
  await expect.element(screen.getByTestId('move-down-choices-1')).toBeDisabled();
});

test('parity/L2-collections: a validator is added as the type that was picked', async () => {
  const designed = surface();
  const screen = await render(<PropertyGridPanel surface={designed} />);

  await screen.getByTestId('add-type-validators').selectOptions('regexvalidator');
  await screen.getByTestId('add-validators').click();

  expect(designed.survey.getQuestionByName('tier')?.getChildren('validators')).toHaveLength(1);
  // And its own properties are L1's fields, with no editor written for validators.
  await screen.getByTestId('open-validators-0').click();
  await expect
    .element(screen.getByTestId('collection-validators').getByLabelText('Regex', { exact: true }))
    .toBeInTheDocument();
});

test('parity/L2-fast-entry: the whole list is edited as text, on blur', async () => {
  const designed = surface();
  const screen = await render(<PropertyGridPanel surface={designed} />);
  const fast = screen.getByTestId('fast-choices');

  await expect.element(fast).toHaveValue('bronze\nsilver|Silver');

  await fast.fill('gold|Gold\nbronze');
  // Still untouched: committing per keystroke would rewrite the list on every character
  // and fill the undo stack with lists nobody meant.
  expect(choices(designed)).toEqual(['bronze', 'silver']);

  await screen.getByTestId('add-choices').click();
  expect(choices(designed)).toEqual(['gold', 'bronze', 'value1']);
  // And the text follows the list when the list changes underneath it — the draft is
  // re-seeded by a change it did not cause, exactly as L1's fields are.
  await expect.element(fast).toHaveValue('gold|Gold\nbronze\nvalue1');
});

test('parity/L2-fast-entry: a validator list has none, because a line cannot say one', async () => {
  const designed = surface();
  const screen = await render(<PropertyGridPanel surface={designed} />);

  expect(screen.container.querySelector('[data-testid="fast-validators"]')).toBeNull();
});
