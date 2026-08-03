/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import { Toolbox } from '@kajay/creator-core';
import type { ToolboxItem } from '@kajay/creator-core';
import { CreatorComponentsProvider, ToolboxPanel } from '@kajay/creator-react';
import type { CreatorButtonProps } from '@kajay/creator-react';
import type { ReactElement } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * The toolbox panel — checklist K1, and the first use of the primitive seam.
 *
 * No stylesheet is loaded here, as in the renderer's browser suite: the claims are
 * about structure, roles and what the model was told, and whether it *looks* like
 * anything is the host demo's job.
 */
/** A host's own button, standing in for whatever their design system exports. */
function HostButton({ children, onClick, ...rest }: CreatorButtonProps): ReactElement {
  return (
    <button type="button" data-host-button="true" onClick={onClick} {...rest}>
      {children}
    </button>
  );
}

function toolbox(): Toolbox {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new Toolbox({ registry });
}

test('parity/K1-toolbox: it draws the registry, grouped and in order', async () => {
  const screen = await render(<ToolboxPanel toolbox={toolbox()} />);

  await expect.element(screen.getByRole('heading', { name: 'Text' })).toBeInTheDocument();
  await expect
    .element(screen.getByRole('button', { name: 'Repeating panel' }))
    .toBeInTheDocument();

  const headings = [...screen.container.querySelectorAll('.kajay-toolbox__category-title')];
  expect(headings.map((heading) => heading.textContent)).toEqual([
    'Text',
    'Choice',
    'Matrix',
    'Panels',
    'Media',
    'Display',
  ]);
});

test('parity/K1-toolbox: typing narrows it, and the model is what changed', async () => {
  const box = toolbox();
  const screen = await render(<ToolboxPanel toolbox={box} />);

  await screen.getByLabelText('Search the toolbox').fill('rank');

  // The panel holds no state of its own (ADR-0021): what it typed into went to the
  // model, and the model is what it read back.
  expect(box.search).toBe('rank');
  await expect.element(screen.getByRole('button', { name: 'Ranking' })).toBeInTheDocument();
  expect(screen.container.querySelectorAll('.kajay-toolbox__button')).toHaveLength(1);
});

test('parity/K1-toolbox: a search that finds nothing says so', async () => {
  const screen = await render(<ToolboxPanel toolbox={toolbox()} />);

  await screen.getByLabelText('Search the toolbox').fill('xylophone');

  // An empty box after typing reads as a broken toolbox, and a designer cannot tell
  // the two apart without being told.
  await expect.element(screen.getByRole('status')).toHaveTextContent('Nothing matches');
});

test('parity/K1-toolbox: picking reports the item and touches nothing', async () => {
  const picked: ToolboxItem[] = [];
  const screen = await render(
    <ToolboxPanel
      toolbox={toolbox()}
      onPick={(item) => {
        picked.push(item);
      }}
    />,
  );

  await screen.getByRole('button', { name: 'Dropdown', exact: true }).click();

  // Where a picked item lands is K2 and K3's business. A toolbox that reached into a
  // survey would be the second thing deciding it.
  expect(picked.map((item) => item.type)).toEqual(['dropdown']);
});

test('parity/K1-toolbox: an item can carry what the created question starts as', async () => {
  const box = toolbox();
  box.add({
    name: 'rating-smileys',
    type: 'rating',
    title: 'Smiley rating',
    defaults: { rateType: 'smileys' },
  });
  const picked: ToolboxItem[] = [];
  const screen = await render(
    <ToolboxPanel
      toolbox={box}
      onPick={(item) => {
        picked.push(item);
      }}
    />,
  );

  await screen.getByRole('button', { name: 'Smiley rating' }).click();

  expect(picked[0]).toMatchObject({ type: 'rating', defaults: { rateType: 'smileys' } });
});

test('parity/K1-primitives: the host draws the buttons if they want to', async () => {
  const screen = await render(
    <CreatorComponentsProvider components={{ Button: HostButton }}>
      <ToolboxPanel toolbox={toolbox()} />
    </CreatorComponentsProvider>,
  );

  // The point of ADR-0022: a host on shadcn/ui or ReUI supplies their own component
  // rather than restyling ours, and gets their focus ring rather than a second one.
  await expect.element(screen.getByRole('button', { name: 'Dropdown', exact: true })).toBeInTheDocument();
  expect(screen.container.querySelectorAll('[data-host-button="true"]').length).toBeGreaterThan(0);
});

test('parity/K1-primitives: replacing one leaves the rest ours', async () => {
  const box = toolbox();
  const screen = await render(
    <CreatorComponentsProvider components={{ Button: HostButton }}>
      <ToolboxPanel toolbox={box} />
    </CreatorComponentsProvider>,
  );

  // The map is partial, and that is what lets a later version add a primitive without
  // breaking a host who supplied one: the search box is still ours and still works.
  await screen.getByLabelText('Search the toolbox').fill('rank');
  expect(box.search).toBe('rank');
});

test('parity/K1-primitives: an explicitly absent entry falls back rather than blanking', async () => {
  const screen = await render(
    <CreatorComponentsProvider components={{ Button: undefined }}>
      <ToolboxPanel toolbox={toolbox()} />
    </CreatorComponentsProvider>,
  );

  // A host building the map conditionally — `{ Button: isFancy ? Fancy : undefined }` —
  // means "use the default", not "draw nothing".
  await expect.element(screen.getByRole('button', { name: 'Dropdown', exact: true })).toBeInTheDocument();
});
