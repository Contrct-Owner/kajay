/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface } from '@kajay/creator-core';
import { PropertyGridPanel } from '@kajay/creator-react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/** Property visibility and read-only rules on screen — checklist L3. */
function surface(definition: SurveyDefinition, select: string): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  const designed = new DesignSurface({ definition, registry });
  const chosen = designed.survey.getQuestionByName(select);
  if (chosen !== undefined) {
    designed.select(chosen);
  }
  return designed;
}

const TIER: SurveyDefinition = {
  pages: [{ name: 'p1', elements: [{ type: 'radiogroup', name: 'tier', choices: ['bronze'] }] }],
};

test('parity/L3-visibility: a field appears when the property it depends on is set', async () => {
  const designed = surface(TIER, 'tier');
  const screen = await render(<PropertyGridPanel surface={designed} />);

  expect(screen.container.querySelector('[data-property="otherText"]')).toBeNull();

  await screen.getByTestId('property-tier-showOtherItem').click();

  await expect.element(screen.getByTestId('property-tier-otherText')).toHaveValue('Other');
});

test('parity/L3-visibility: a section with nothing left in it is not drawn', async () => {
  const designed = surface(
    { pages: [{ name: 'p1', elements: [{ type: 'html', name: 'note' }] }] },
    'note',
  );
  const screen = await render(<PropertyGridPanel surface={designed} />);

  // A display element has no validation properties at all, so there is no empty heading
  // where a designer would look for one — the same rule that hides an empty category.
  expect(screen.container.querySelector('[data-testid="properties-Validation"]')).toBeNull();
});

test('parity/L3-read-only: a fixed property is readable, not disabled', async () => {
  const designed = surface(
    {
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'who', isRequired: true, requiredIf: '{tier} = 1' },
            { type: 'text', name: 'tier' },
          ],
        },
      ],
    },
    'who',
  );
  const screen = await render(<PropertyGridPanel surface={designed} />);
  const required = screen.getByTestId('property-who-isRequired');

  // E7's rule: `aria-disabled`, never the HTML `disabled` attribute, so the control keeps
  // its place in the tab order and stays announced.
  await expect.element(required).toHaveAttribute('aria-disabled', 'true');
  await expect.element(required).not.toHaveAttribute('disabled');
  await expect.element(required).toBeChecked();
});

test('parity/L3-read-only: clicking a fixed checkbox changes nothing', async () => {
  const designed = surface(
    {
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'who', isRequired: true, requiredIf: '{tier} = 1' },
            { type: 'text', name: 'tier' },
          ],
        },
      ],
    },
    'who',
  );
  const screen = await render(<PropertyGridPanel surface={designed} />);
  const required = screen.getByTestId('property-who-isRequired');

  // Dispatched rather than clicked: `aria-disabled` fails the harness's own actionability
  // check, which is exactly the point — it says the control cannot be operated — so the
  // only way to prove the *model* refuses is to reach past that and try.
  required.element().dispatchEvent(new MouseEvent('click', { bubbles: true }));

  // The guard is on the handler, not on the click: React synthesizes `onChange` for a
  // checkbox from the click itself, so cancelling the default would stop the browser
  // toggling the box and not stop the model being written.
  expect(designed.survey.getQuestionByName('who')?.getPropertyValue('isRequired')).toBe(true);
  await expect.element(required).toBeChecked();
});

test('parity/L3-read-only: a fixed text field is readonly rather than disabled', async () => {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  registry.addProperty('text', { name: 'lockable', type: 'boolean' });
  registry.addProperty('text', {
    name: 'locked',
    type: 'string',
    defaultValue: 'fixed',
    readOnlyIf: '{lockable} = true',
  });
  const designed = new DesignSurface({
    definition: { pages: [{ name: 'p1', elements: [{ type: 'text', name: 'who' }] }] },
    registry,
  });
  const who = designed.survey.getQuestionByName('who');
  if (who !== undefined) {
    designed.select(who);
  }
  const screen = await render(<PropertyGridPanel surface={designed} />);

  await expect.element(screen.getByTestId('property-who-locked')).not.toHaveAttribute('readonly');

  await screen.getByTestId('property-who-lockable').click();

  // Still readable and still focusable: a designer looking at a property they may not
  // change has to be able to see what it says.
  await expect.element(screen.getByTestId('property-who-locked')).toHaveAttribute('readonly');
  await expect.element(screen.getByTestId('property-who-locked')).toHaveValue('fixed');
});
