/// <reference types="@vitest/browser/matchers" />
import { parseSurvey } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { Survey } from '@kajay/react';
import type { SurveyButtonProps } from '@kajay/react';
import type { ReactElement } from 'react';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * The renderer drawn with a host's own button — checklist P2.
 *
 * ADR-0022 says two things need testing where there was one: the defaults, and at least
 * one scenario rendered through a replacement map. The other forty-three browser files are
 * the first. This is the second, and without it the seam would be a mechanism nothing had
 * ever exercised — the defaults would keep every existing test green whether substitution
 * worked or not.
 */
const TWO_PAGES: SurveyDefinition = {
  pages: [
    { name: 'p1', elements: [{ type: 'text', name: 'who', title: 'Your name' }] },
    { name: 'p2', elements: [{ type: 'text', name: 'why', title: 'Why?' }] },
  ],
};

const RANKING: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'ranking', name: 'order', title: 'Best first', choices: ['Speed', 'Price'] },
      ],
    },
  ],
};

/** What an adopter's design system looks like from here: their element, their class. */
function HostButton({ children, className, ...rest }: SurveyButtonProps): ReactElement {
  return (
    <button className={`${className ?? ''} host-button`} data-host="yes" {...rest}>
      {children}
    </button>
  );
}

function survey(definition: SurveyDefinition) {
  return parseSurvey(definition).survey;
}

test('parity/P2-primitives: a supplied Button draws every action in the survey', async () => {
  const screen = await render(
    <Survey model={survey(TWO_PAGES)} components={{ Button: HostButton }} />,
  );

  // Navigation is the button every survey has, so it is the one that proves the map
  // reached the renderer at all.
  const next = screen.container.querySelector('button[data-host="yes"]');
  expect(next).not.toBeNull();
  // The class the renderer asked for survives the substitution, because a host who wants
  // *both* — their component and our stylesheet — must not have to choose.
  expect(next?.className).toContain('kajay-navigation__next');
  expect(next?.className).toContain('host-button');
});

test('parity/P2-primitives: no map means the shipped native button, unchanged', async () => {
  const screen = await render(<Survey model={survey(TWO_PAGES)} />);

  // The defaults are the reason nothing has to be supplied, and the reason the existing
  // suites are this change's regression net rather than work redone beside it.
  expect(screen.container.querySelector('button[data-host="yes"]')).toBeNull();
  await expect.element(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
});

test('parity/P2-primitives: a substituted Button still carries the drag gesture', async () => {
  const screen = await render(
    <Survey model={survey(RANKING)} components={{ Button: HostButton }} />,
  );

  // **The contract's sharpest clause.** A ranking row *is* a button, and its reorder
  // gesture arrives as pointer and key handlers spread onto it. A primitive that dropped
  // them would break dragging silently — a spread bypasses excess-property checking, so
  // nothing would complain at build time and nothing would look wrong on screen.
  const row = screen.container.querySelector('button[data-reorder-item][data-host="yes"]');
  expect(row).not.toBeNull();
  expect(row?.getAttribute('aria-roledescription')).not.toBeNull();
  expect(row?.getAttribute('tabindex')).toBe('0');
});

test('parity/P2-primitives: an explicitly undefined entry means the default', async () => {
  const screen = await render(
    <Survey model={survey(TWO_PAGES)} components={{ Button: undefined }} />,
  );

  // A host building the map conditionally — `{ Button: isFancy ? Fancy : undefined }` —
  // means "use yours", not "draw nothing". This is also what makes the set extensible: a
  // primitive added later cannot break a host, because there is no such thing as a full map.
  await expect.element(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  expect(screen.container.querySelector('button[data-host="yes"]')).toBeNull();
});

test('parity/P2-primitives: the host’s button is what actually gets pressed', async () => {
  const onComplete = vi.fn();
  const model = survey(TWO_PAGES);
  model.onComplete.add(() => {
    onComplete();
  });
  const screen = await render(<Survey model={model} components={{ Button: HostButton }} />);

  await screen.getByRole('button', { name: 'Next' }).click();
  await screen.getByRole('button', { name: 'Complete' }).click();

  // Drawing it is half the claim; a substituted primitive that rendered correctly and
  // swallowed the click would pass every assertion above.
  expect(onComplete).toHaveBeenCalledTimes(1);
});
