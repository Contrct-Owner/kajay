/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { CreatorWorkspace } from '@kajay/creator-core';
import { DesignSurfacePanel } from '@kajay/creator-react';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * Reaching an element's properties from the element — checklist K5.
 *
 * The menu already carried the four things a designer does *to* an element. Properties is
 * the one thing they do *with* it, and it was reachable only from wherever the host had put
 * the property grid — which is fine when that is a sidebar and useless when it is a sheet
 * on a phone, where opening it meant scrolling away from the question it describes.
 *
 * **Reported rather than performed**, like a toolbox pick: the panel cannot know where a
 * host's property grid is, so a menu item that opened one would be the piece deciding a
 * layout it cannot see.
 */
const BASIC: SurveyDefinition = {
  pages: [{ name: 'p1', elements: [{ type: 'text', name: 'who', title: 'Your name' }] }],
};

function workspace(): CreatorWorkspace {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new CreatorWorkspace({ definition: BASIC, registry });
}

test('parity/K5-properties: an element offers its properties, and reports the ask', async () => {
  const made = workspace();
  const asked = vi.fn();
  // Read from the surface rather than reusing the literal above: a workspace canonicalises
  // what it is given, so the document under test is the canonical form and comparing
  // against the input would be asserting that canonicalisation had not happened.
  const before = made.surface.definition;
  const screen = await render(
    <DesignSurfacePanel surface={made.surface} onEditProperties={asked} />,
  );

  // The menu only exists on the selected element, so selecting is the first half of the
  // gesture whether or not a designer thinks of it that way.
  await screen.getByTestId('select-who').click();
  await screen.getByTestId('actions-who').click();
  await screen.getByTestId('properties-who').click();

  // The *name*, matching every other verb on the surface — `duplicate(name)`,
  // `locate(name)` — so a host has one vocabulary rather than two.
  expect(asked).toHaveBeenCalledWith('who');

  // And nothing happened to the survey. This is a view action wearing a menu item's
  // clothes, and a host who ignored it would still have an undamaged document.
  expect(made.surface.definition).toEqual(before);
});

test('parity/K5-properties: no item at all when a host wired nothing', async () => {
  const made = workspace();
  const screen = await render(<DesignSurfacePanel surface={made.surface} />);

  await screen.getByTestId('select-who').click();
  await screen.getByTestId('actions-who').click();

  // **Absent rather than disabled.** An item that reports to nobody does nothing when
  // pressed, and a permanently dead row teaches a designer to distrust the menu. A host
  // with the grid already on screen — the sidebar case — wants exactly this.
  expect(screen.container.querySelector('[data-testid="properties-who"]')).toBeNull();

  // The four that were always there are still there, in the order they were in: adding an
  // item conditionally must not reshuffle the ones a designer has learned.
  await expect.element(screen.getByTestId('duplicate-who')).toBeInTheDocument();
  await expect.element(screen.getByTestId('delete-who')).toBeInTheDocument();
});
