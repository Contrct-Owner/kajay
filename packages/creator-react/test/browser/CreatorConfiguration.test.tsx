/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { SurveyCreator } from '@kajay/creator-react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/** Configuration — checklist N2. */
const BASIC: SurveyDefinition = {
  pages: [{ name: 'p1', elements: [{ type: 'text', name: 'who', title: 'Your name' }] }],
};

function registry(): MetadataRegistry {
  const made = new MetadataRegistry();
  registerBuiltInTypes(made);
  return made;
}

test('parity/N2-tabs: a host names the tabs they want, in order', async () => {
  const screen = await render(
    <SurveyCreator value={BASIC} registry={registry()} tabs={['preview', 'design']} />,
  );

  // The first named tab is the one the Creator opens on, so "which tabs" and "which one
  // first" are one decision rather than two.
  await expect.element(screen.getByTestId('preview-frame')).toBeInTheDocument();
  expect(screen.container.querySelector('[data-testid="creator-tab-json"]')).toBeNull();
  expect(screen.container.querySelector('[data-testid="creator-tab-theme"]')).toBeNull();
  await expect.element(screen.getByTestId('creator-tab-design')).toBeInTheDocument();
});

test('parity/N2-types: the toolbox offers only what the configuration allows', async () => {
  const screen = await render(
    <SurveyCreator
      value={BASIC}
      registry={registry()}
      configuration={{ allowedTypes: ['text', 'comment'] }}
    />,
  );

  // Toolbox items are keyed by *name*, not type (K1): one type can appear twice under
  // different names, which is why the restriction is checked against the type.
  await expect.element(screen.getByTestId('toolbox-text')).toBeInTheDocument();
  expect(screen.container.querySelector('[data-testid="toolbox-file"]')).toBeNull();
});

test('parity/N2-types: a restricted type is not offered as a conversion either', async () => {
  const screen = await render(
    <SurveyCreator
      value={BASIC}
      registry={registry()}
      configuration={{ blockedTypes: ['comment'] }}
    />,
  );

  await screen.getByTestId('select-who').click();

  const picker = screen.getByLabelText('Type of who').element() as HTMLSelectElement;
  const offered = [...picker.options].map((option) => option.value);
  // A type a designer may not add is one they may not convert into.
  expect(offered).not.toContain('comment');
  expect(offered).toContain('text');
});

test('parity/N2-read-only: a read-only Creator shows everything and changes nothing', async () => {
  const screen = await render(
    <SurveyCreator value={BASIC} registry={registry()} configuration={{ isReadOnly: true }} />,
  );

  // Still a viewer: the canvas is there and the question is selectable, because a reviewer
  // needs to see the survey to comment on it.
  await screen.getByTestId('select-who').click();
  await expect.element(screen.getByLabelText('Title of who')).toBeInTheDocument();

  await screen.getByLabelText('Title of who').fill('Renamed');

  // Nothing reached the survey. The rule is at the two chokepoints, not on the button.
  await expect.element(screen.getByTestId('select-who')).toBeInTheDocument();
  expect(screen.container.querySelector('[data-testid="select-Renamed"]')).toBeNull();
});

test('parity/N2-grid: the configuration carries the grid’s own restrictions', async () => {
  const screen = await render(
    <SurveyCreator
      value={BASIC}
      registry={registry()}
      configuration={{ grid: { hidden: ['visibleIf', 'enableIf'] } }}
    />,
  );

  await screen.getByTestId('select-who').click();

  // §L4's options travel inside the configuration, so a deployment says everything it has
  // turned off in one value rather than in two that can disagree.
  await expect.element(screen.getByLabelText('Title', { exact: true })).toBeInTheDocument();
  expect(screen.container.querySelector('[data-testid="property-who-visibleIf"]')).toBeNull();
});
