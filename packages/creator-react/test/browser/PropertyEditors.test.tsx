/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface } from '@kajay/creator-core';
import type { PropertyGridOptions } from '@kajay/creator-core';
import {
  PropertyEditorProvider,
  PropertyGridPanel,
  useCreatorComponents,
} from '@kajay/creator-react';
import type { PropertyEditorProps, PropertyEditorResolver } from '@kajay/creator-react';
import type { ReactElement } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/** The property-grid customization API on screen — checklist L4. */
const BASIC: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [{ type: 'radiogroup', name: 'tier', title: 'Tier', choices: ['bronze'] }],
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

/**
 * A picker for a property the registry can only call a `string`.
 *
 * L1 named this gap and declined to guess at it — inferring a domain by parsing an English
 * description is not something to build. A host knows, so a host says.
 */
function TitleLocationEditor({
  surface: designed,
  element,
  row,
  id,
  hint,
  testId,
}: PropertyEditorProps): ReactElement {
  const { Select } = useCreatorComponents();

  return (
    <Select
      className="kajay-properties__input"
      id={id}
      data-testid={testId}
      aria-describedby={hint}
      value={typeof row.value === 'string' ? row.value : 'default'}
      options={['default', 'top', 'left', 'hidden'].map((value) => ({ value, label: value }))}
      onValueChange={(value) => {
        designed.setProperty(element, row.name, value);
      }}
    />
  );
}

const byName: PropertyEditorResolver = (row) =>
  row.name === 'titleLocation' ? TitleLocationEditor : undefined;

test('parity/L4-editors: a host’s editor replaces the built-in one', async () => {
  const designed = surface();
  const screen = await render(
    <PropertyEditorProvider resolve={byName}>
      <PropertyGridPanel surface={designed} />
    </PropertyEditorProvider>,
  );

  await screen.getByTestId('property-tier-titleLocation').selectOptions('left');

  // A `<select>` where the Creator drew a text field, writing through the same
  // `setProperty` — which is what makes L1's named gap a host's to close.
  expect(designed.survey.getQuestionByName('tier')?.getPropertyValue('titleLocation')).toBe('left');
});

test('parity/L4-editors: the replacement keeps the row’s label and hint', async () => {
  const designed = surface();
  const screen = await render(
    <PropertyEditorProvider resolve={byName}>
      <PropertyGridPanel surface={designed} />
    </PropertyEditorProvider>,
  );

  // The id is handed to the editor rather than left for it to invent, so a replacement
  // cannot end up as a field with no label attached to it.
  await expect
    .element(screen.getByLabelText('Title location', { exact: true }))
    .toHaveValue('default');
});

test('parity/L4-editors: everything else keeps the built-in field', async () => {
  const designed = surface();
  const screen = await render(
    <PropertyEditorProvider resolve={byName}>
      <PropertyGridPanel surface={designed} />
    </PropertyEditorProvider>,
  );

  await expect.element(screen.getByTestId('property-tier-title')).toHaveValue('Tier');
});

test('parity/L4-editors: a resolver can key on the editor kind instead', async () => {
  const designed = surface();
  const byKind: PropertyEditorResolver = (row) =>
    row.editor === 'json' ? TitleLocationEditor : undefined;
  const screen = await render(
    <PropertyEditorProvider resolve={byKind}>
      <PropertyGridPanel surface={designed} />
    </PropertyEditorProvider>,
  );

  // A function rather than a map, so "every JSON field" and "the property called text"
  // are both sayable and neither has to be disambiguated from the other.
  await expect.element(screen.getByTestId('property-tier-correctAnswer')).toHaveValue('default');
});

test('parity/L4-editors: no provider means the built-in editors', async () => {
  const designed = surface();
  const screen = await render(<PropertyGridPanel surface={designed} />);

  await expect.element(screen.getByTestId('property-tier-titleLocation')).toHaveValue('default');
  expect(screen.getByTestId('property-tier-titleLocation').element().tagName).toBe('INPUT');
});

test('parity/L4-customization: the panel draws what the host asked for', async () => {
  const designed = surface();
  const grid: PropertyGridOptions = {
    hidden: ['valueName'],
    titles: { colCount: 'Columns' },
    order: ['title', 'name'],
  };
  const screen = await render(<PropertyGridPanel surface={designed} grid={grid} />);

  expect(screen.container.querySelector('[data-property="valueName"]')).toBeNull();
  await expect.element(screen.getByLabelText('Columns', { exact: true })).toBeInTheDocument();

  const general = screen.getByTestId('properties-tier-General').element();
  const order = [...general.querySelectorAll<HTMLElement>('[data-property]')].map(
    (row) => row.dataset['property'],
  );
  expect(order.slice(0, 2)).toEqual(['title', 'name']);
});
