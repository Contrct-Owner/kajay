/// <reference types="@vitest/browser/matchers" />
import { CreatorComponentsProvider } from '@kajay/creator-react';
import type { CreatorMenuProps } from '@kajay/creator-react';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';
import { useCreatorComponents } from '@kajay/creator-react';
import type { ReactElement } from 'react';

/** The Menu primitive's behavioural contract — checklist P4, ADR-0022. */
function Harness(props: CreatorMenuProps): ReactElement {
  const { Menu } = useCreatorComponents();
  return <Menu {...props} />;
}

function menuWith(onSelect: (id: string) => void): ReactElement {
  return (
    <Harness
      label="Actions for who"
      data-testid="menu"
      onSelect={onSelect}
      items={[
        { id: 'duplicate', label: 'Duplicate' },
        { id: 'copy', label: 'Copy' },
        { id: 'paste', label: 'Paste', isDisabled: true },
        { id: 'delete', label: 'Delete', isDestructive: true },
      ]}
    />
  );
}

test('parity/P4-menu: the trigger says what it controls', async () => {
  const screen = await render(menuWith(vi.fn()));

  const trigger = screen.getByTestId('menu');
  // Without these a screen reader says "button, three dots" — which is an ellipsis, not a
  // menu. ADR-0022 makes a primitive's behaviour part of its contract.
  await expect.element(trigger).toHaveAttribute('aria-haspopup', 'menu');
  await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');

  await trigger.click();

  await expect.element(screen.getByTestId('menu')).toHaveAttribute('aria-expanded', 'true');
  await expect.element(screen.getByRole('menu')).toBeInTheDocument();
});

test('parity/P4-menu: choosing an item reports it and closes', async () => {
  const chosen = vi.fn();
  const screen = await render(menuWith(chosen));

  await screen.getByTestId('menu').click();
  await screen.getByTestId('duplicate').click();

  expect(chosen).toHaveBeenCalledWith('duplicate');
  await expect.element(screen.getByTestId('menu')).toHaveAttribute('aria-expanded', 'false');
});

test('parity/P4-menu: a disabled item is offered and does nothing', async () => {
  const chosen = vi.fn();
  const screen = await render(menuWith(chosen));

  await screen.getByTestId('menu').click();

  // Still listed, so the menu is not a different length depending on history — which is how
  // a designer loses the item they were reaching for.
  await expect.element(screen.getByTestId('paste')).toBeDisabled();
  expect(chosen).not.toHaveBeenCalled();
});

test('parity/P4-menu: it opens on the arrows and walks with them', async () => {
  const chosen = vi.fn();
  const screen = await render(menuWith(chosen));

  await screen.getByTestId('menu').click();
  await screen.getByTestId('menu').click();
  (await screen.getByTestId('menu').element()).focus();
  await userEvent.keyboard('{ArrowDown}');

  // Down opens at the top, which is what every other menu on the machine does — and is what
  // makes the list reachable with no pointer at all.
  await expect.element(screen.getByTestId('duplicate')).toHaveFocus();

  await userEvent.keyboard('{ArrowDown}');
  await expect.element(screen.getByTestId('copy')).toHaveFocus();

  await userEvent.keyboard('{Enter}');
  expect(chosen).toHaveBeenCalledWith('copy');
});

test('parity/P4-menu: Escape closes it and hands focus back', async () => {
  const screen = await render(menuWith(vi.fn()));

  await screen.getByTestId('menu').click();
  await userEvent.keyboard('{Escape}');

  // A menu that closed and left focus on the page body costs a keyboard user their place.
  await expect.element(screen.getByTestId('menu')).toHaveAttribute('aria-expanded', 'false');
  await expect.element(screen.getByTestId('menu')).toHaveFocus();
});

test('parity/P4-menu: a host’s own menu replaces ours entirely', async () => {
  const chosen = vi.fn();
  const screen = await render(
    <CreatorComponentsProvider
      components={{
        Menu: ({ items, onSelect }) => (
          <div data-testid="host-menu">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelect(item.id);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        ),
      }}
    >
      {menuWith(chosen)}
    </CreatorComponentsProvider>,
  );

  // The items arrive as data and the host composes the whole tree — which is what makes
  // `Menu` a leaf under ADR-0022's amendment, and why a shadcn adapter is a re-export.
  await expect.element(screen.getByTestId('host-menu')).toBeInTheDocument();
  await screen.getByText('Delete').click();
  expect(chosen).toHaveBeenCalledWith('delete');
});

test('parity/P4-menu: a caller’s class is added to ours, never swapped for it', async () => {
  // **The regression, stated as structure**, because this suite renders unstyled markup —
  // no stylesheet is loaded, so it cannot see position at all. `kajay-menu` carries the
  // `position: relative` the list anchors to; when a layout class *replaced* it the menu
  // opened hundreds of pixels away, against some distant ancestor. The geometry is proved
  // in the demo E2E, where the real stylesheet is.
  const screen = await render(
    <Harness
      label="Actions for who"
      data-testid="menu"
      className="kajay-designer__menu"
      onSelect={vi.fn()}
      items={[{ id: 'duplicate', label: 'Duplicate' }]}
    />,
  );

  const root = (await screen.getByTestId('menu').element()).parentElement;
  expect(root?.classList.contains('kajay-menu')).toBe(true);
  expect(root?.classList.contains('kajay-designer__menu')).toBe(true);
});
