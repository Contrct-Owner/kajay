/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { CreatorStringDictionary, DesignSurface } from '@kajay/creator-core';
import { CreatorNotices, CreatorStringsProvider } from '@kajay/creator-react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/** The Creator says what it did unasked — checklist P6, ADR-0023. */
const NESTED: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        {
          type: 'panel',
          name: 'group',
          elements: [
            { type: 'text', name: 'who' },
            { type: 'text', name: 'where' },
          ],
        },
      ],
    },
  ],
};

function surfaceWith(): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition: NESTED, registry });
}

test('parity/P6-notices-shown: it says what a delete took with it', async () => {
  const surface = surfaceWith();
  const screen = await render(<CreatorNotices surface={surface} />);

  await expect.element(screen.getByTestId('creator-notices')).toHaveTextContent('');

  surface.removeElement('group');

  await expect
    .element(screen.getByTestId('creator-notices'))
    .toHaveTextContent('Deleted “group” and the 2 elements inside it.');
});

test('parity/P6-notices-shown: it is polite, not assertive', async () => {
  const surface = surfaceWith();
  const screen = await render(<CreatorNotices surface={surface} />);

  const region = screen.getByTestId('creator-notices');
  // These announce things that *worked*. `role="status"` waits for a pause rather than
  // cutting across what a screen reader is already saying — which is the distinction from
  // P5's refusal note, where somebody is waiting for the answer.
  await expect.element(region).toHaveAttribute('role', 'status');
  await expect.element(region).toHaveAttribute('aria-live', 'polite');
});

test('parity/P6-notices-shown: the newest replaces the last', async () => {
  const surface = surfaceWith();
  const screen = await render(<CreatorNotices surface={surface} />);

  surface.copy('group');
  surface.paste();
  await expect.element(screen.getByTestId('creator-notices')).toHaveTextContent('renumbered');

  surface.removeElement('group');

  // One line, not a stack. A notification centre is where messages go to be dismissed
  // unread; the most recent thing done to the survey is the one worth the room.
  await expect.element(screen.getByTestId('creator-notices')).toHaveTextContent('Deleted');
  await expect.element(screen.getByTestId('creator-notices')).not.toHaveTextContent('renumbered');
});

test('parity/P6-notices-shown: the words are the host’s when they supply them', async () => {
  const strings = new CreatorStringDictionary();
  strings.register('en', { noticeRemovedWithChildren: 'Removed {0} plus {1} more.' });
  const surface = surfaceWith();

  const screen = await render(
    <CreatorStringsProvider dictionary={strings}>
      <CreatorNotices surface={surface} />
    </CreatorStringsProvider>,
  );

  surface.removeElement('group');

  await expect
    .element(screen.getByTestId('creator-notices'))
    .toHaveTextContent('Removed group plus 2 more.');
});
