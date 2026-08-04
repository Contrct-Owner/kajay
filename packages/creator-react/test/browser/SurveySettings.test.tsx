/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface } from '@kajay/creator-core';
import { PageNavigatorPanel, PropertyGridPanel } from '@kajay/creator-react';
import type { ReactElement } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/** Survey-level and page-level settings — checklist L5. */
const BASIC: SurveyDefinition = {
  title: 'A survey',
  pages: [
    { name: 'p1', title: 'First', elements: [{ type: 'text', name: 'who', title: 'Your name' }] },
  ],
};

function surface(): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition: BASIC, registry });
}

/**
 * The navigator and the grid together, which is the assembly this row is about: one piece
 * selects the survey and a different one draws it, with neither knowing about the other.
 */
function Designer({ designed }: { readonly designed: DesignSurface }): ReactElement {
  return (
    <>
      <PageNavigatorPanel surface={designed} />
      <PropertyGridPanel surface={designed} />
    </>
  );
}

test('parity/L5-survey-settings: the survey is reachable from the page navigator', async () => {
  const designed = surface();
  const screen = await render(<Designer designed={designed} />);

  await expect
    .element(screen.getByText('Select a question or a page to edit it.'))
    .toBeInTheDocument();

  await screen.getByTestId('select-survey').click();

  // A registered class like any other, so its grid is generated with no code about
  // surveys anywhere in the panel.
  await expect.element(screen.getByLabelText('Title', { exact: true })).toHaveValue('A survey');
  await expect.element(screen.getByLabelText('Show progress bar', { exact: true })).toBeInTheDocument();
});

test('parity/L5-survey-settings: selecting is not navigating', async () => {
  const designed = surface();
  const screen = await render(<Designer designed={designed} />);

  await screen.getByTestId('select-survey').click();

  // The canvas still shows a page. Saying `aria-current` about something nobody has
  // navigated to would be the one claim this list must not get wrong.
  await expect.element(screen.getByTestId('select-survey')).not.toHaveAttribute('aria-current');
  await expect.element(screen.getByTestId('select-survey')).toHaveAttribute('data-selected', 'true');
  expect(designed.page?.name).toBe('p1');
});

test('parity/L5-survey-settings: an edit reaches the definition', async () => {
  const designed = surface();
  const screen = await render(<Designer designed={designed} />);
  await screen.getByTestId('select-survey').click();

  await screen.getByLabelText('Title', { exact: true }).fill('Renamed survey');

  expect(designed.definition['title']).toBe('Renamed survey');
});

test('parity/L5-survey-settings: what the survey holds is editable too', async () => {
  const designed = surface();
  const screen = await render(<Designer designed={designed} />);
  await screen.getByTestId('select-survey').click();

  await screen.getByTestId('add-calculatedValues').click();

  // Calculated values, triggers and conditional endings arrive as collection editors for
  // the same reason a question's choices do — no code about any of them.
  expect(designed.survey.calculatedValues).toHaveLength(1);
  // `pages` is not among them: the navigator beside this grid owns that list.
  expect(screen.container.querySelector('[data-testid="collection-pages"]')).toBeNull();
});

test('parity/L5-survey-settings: selecting a page takes the selection off the survey', async () => {
  const designed = surface();
  const screen = await render(<Designer designed={designed} />);
  await screen.getByTestId('select-survey').click();

  designed.select(designed.pages[0]!);

  await expect.element(screen.getByTestId('select-survey')).not.toHaveAttribute('data-selected');
  await expect.element(screen.getByLabelText('Name', { exact: true })).toHaveValue('p1');
});

test('parity/L5-page-settings: a page’s own settings are its grid', async () => {
  const designed = surface();
  const screen = await render(<Designer designed={designed} />);

  designed.select(designed.pages[0]!);

  // K4 made the page selectable; L1 generated the grid. This row needed neither to change.
  await expect.element(screen.getByLabelText('Title', { exact: true })).toHaveValue('First');
  await expect.element(screen.getByLabelText('Max time to finish', { exact: true })).toBeInTheDocument();
});
