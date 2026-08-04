import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { CreatorMenuItem, CreatorMenuProps } from './CreatorComponents.js';

/**
 * The shipped menu — checklist P4, [ADR-0022](../../../docs/adr/0022-design-system-primitives.md).
 *
 * **A leaf by the amendment's rule**, which is why `Menu` is admissible where `RadioGroup`
 * was not: the items arrive as *data*, the host's component composes the whole thing
 * internally, and the library has no markup of its own to interleave between them. Exactly
 * `Select`'s shape, for exactly `Select`'s reason.
 *
 * **The contract is behavioural.** ADR-0022 says a primitive's promises include how it
 * behaves, and a menu that opens is not a menu: Escape closes it and gives focus back,
 * arrows walk it, Enter and Space choose, clicking away closes it, and the trigger says
 * what it controls. A host substituting Radix's `DropdownMenu` gets all of that; a host
 * substituting a `<div onClick>` owns the outcome, which is the deal the ADR already
 * struck.
 */
export function DefaultMenu({
  label,
  items,
  onSelect,
  className,
  'data-testid': testId,
}: CreatorMenuProps): ReactElement {
  const listId = useId();
  const { isOpen, setOpen, active, setActive, root, trigger, close } = useMenuState();

  const choose = (item: CreatorMenuItem): void => {
    // A disabled item is still in the list — see `actionsFor` for why — so choosing one has
    // to do nothing rather than be impossible to reach.
    if (item.isDisabled === true) {
      return;
    }
    close(true);
    onSelect(item.id);
  };

  return (
    <div className={className ?? 'kajay-menu'} ref={root}>
      <MenuTrigger
        ref={trigger}
        listId={isOpen ? listId : undefined}
        label={label}
        testId={testId}
        isOpen={isOpen}
        onToggle={() => {
          setActive(0);
          setOpen(!isOpen);
        }}
        onOpenAt={(index) => {
          setActive(index === 'last' ? items.length - 1 : 0);
          setOpen(true);
        }}
      />
      {isOpen ? (
        <MenuList
          id={listId}
          label={label}
          items={items}
          active={active}
          onActive={setActive}
          onChoose={choose}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

/**
 * Open, closed, and where the cursor is.
 *
 * Its own hook because it is the whole of the menu's state and none of its markup, and
 * because `close` has to be stable for the dismissal listeners to be added once rather
 * than on every render.
 */
function useMenuState(): {
  readonly isOpen: boolean;
  readonly setOpen: (open: boolean) => void;
  readonly active: number;
  readonly setActive: (index: number) => void;
  readonly root: React.RefObject<HTMLDivElement | null>;
  readonly trigger: React.RefObject<HTMLButtonElement | null>;
  readonly close: (returnFocus: boolean) => void;
} {
  const [isOpen, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) {
      trigger.current?.focus();
    }
  }, []);

  useDismissal(root, isOpen, close);

  return { isOpen, setOpen, active, setActive, root, trigger, close };
}

/**
 * The button that opens it.
 *
 * `aria-haspopup` and `aria-expanded` are the whole of what a screen reader needs to say
 * "menu, collapsed" rather than "button, three dots"; `aria-controls` points at the list
 * only while there is one to point at.
 */
function MenuTrigger({
  ref,
  listId,
  label,
  testId,
  isOpen,
  onToggle,
  onOpenAt,
}: {
  readonly ref: React.RefObject<HTMLButtonElement | null>;
  readonly listId: string | undefined;
  readonly label: string;
  readonly testId: string | undefined;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  readonly onOpenAt: (index: 'first' | 'last') => void;
}): ReactElement {
  return (
    <button
      type="button"
      ref={ref}
      className="kajay-menu__trigger"
      data-testid={testId}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={isOpen}
      aria-controls={listId}
      onClick={onToggle}
      onKeyDown={(event) => {
        // Down opens at the top and up opens at the bottom, which is what every menu on the
        // machine does and what makes the list reachable without a pointer at all.
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          onOpenAt(event.key === 'ArrowDown' ? 'first' : 'last');
        }
      }}
    >
      ⋯
    </button>
  );
}

/**
 * The open list.
 *
 * Its own component so the trigger above stays readable, and because roving focus is a
 * self-contained job: exactly one item is tabbable at a time, and the arrows move which.
 */
function MenuList({
  id,
  label,
  items,
  active,
  onActive,
  onChoose,
  onClose,
}: {
  readonly id: string;
  readonly label: string;
  readonly items: readonly CreatorMenuItem[];
  readonly active: number;
  readonly onActive: (index: number) => void;
  readonly onChoose: (item: CreatorMenuItem) => void;
  readonly onClose: (returnFocus: boolean) => void;
}): ReactElement {
  const list = useRef<HTMLDivElement>(null);

  // Focus follows the active item, which is what makes the arrows audible: a screen reader
  // announces the item it lands on rather than the designer walking an invisible cursor.
  useEffect(() => {
    const buttons = list.current?.querySelectorAll('button');
    buttons?.[active]?.focus();
  }, [active]);

  return (
    <div
      id={id}
      className="kajay-menu__list"
      role="menu"
      aria-label={label}
      ref={list}
      onKeyDown={(event) => {
        walk(event, { active, total: items.length, onActive, onClose });
      }}
    >
      {items.map((item, index) => (
        <MenuItem
          key={item.id}
          item={item}
          isActive={index === active}
          onChoose={onChoose}
        />
      ))}
    </div>
  );
}

/** One choice. Its own component for the file's function-length limit, and it reads better. */
function MenuItem({
  item,
  isActive,
  onChoose,
}: {
  readonly item: CreatorMenuItem;
  readonly isActive: boolean;
  readonly onChoose: (item: CreatorMenuItem) => void;
}): ReactElement {
  return (
    <button
      type="button"
      role="menuitem"
      className={
        item.isDestructive === true
          ? 'kajay-menu__item kajay-menu__item--danger'
          : 'kajay-menu__item'
      }
      data-testid={item.id}
      disabled={item.isDisabled}
      // Roving focus: exactly one item is tabbable, and the arrows move which. A menu where
      // every item is a tab stop makes Tab the wrong key for leaving it.
      tabIndex={isActive ? 0 : -1}
      onClick={() => {
        onChoose(item);
      }}
    >
      {item.label}
    </button>
  );
}

/** The list's whole keyboard contract: move, or leave. */
function walk(
  event: { readonly key: string; readonly preventDefault: () => void },
  list: {
    readonly active: number;
    readonly total: number;
    readonly onActive: (index: number) => void;
    readonly onClose: (returnFocus: boolean) => void;
  },
): void {
  const next = stepFor(event.key, list.active, list.total);
  if (next !== undefined) {
    event.preventDefault();
    list.onActive(next);
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    // Focus goes back to the trigger: a menu that closed and left focus on the page body
    // costs a keyboard user their place.
    list.onClose(true);
  }
}

/** Where an arrow key goes from here. `undefined` when the key is not a movement. */
function stepFor(key: string, active: number, total: number): number | undefined {
  switch (key) {
    case 'ArrowDown':
      // Wrapping, because a menu is a ring: pressing down at the bottom to reach the top
      // is what every other menu on the machine does.
      return (active + 1) % total;
    case 'ArrowUp':
      return (active - 1 + total) % total;
    case 'Home':
      return 0;
    case 'End':
      return total - 1;
    default:
      return undefined;
  }
}

/**
 * Closes the menu when the pointer goes elsewhere, or focus leaves it entirely.
 *
 * `pointerdown` rather than `click`: a click that started outside and finished inside would
 * otherwise close the menu *and* choose an item. Focus is watched separately because a Tab
 * out is a dismissal too, and it produces no pointer event at all.
 */
function useDismissal(
  root: React.RefObject<HTMLDivElement | null>,
  isOpen: boolean,
  close: (returnFocus: boolean) => void,
): void {
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const isOutside = (target: EventTarget | null): boolean =>
      target instanceof Node && root.current !== null && !root.current.contains(target);
    const onPointerDown = (event: PointerEvent): void => {
      if (isOutside(event.target)) {
        // No focus return: the designer has already said where they want to be.
        close(false);
      }
    };
    const onFocusIn = (event: FocusEvent): void => {
      if (isOutside(event.target)) {
        close(false);
      }
    };
    globalThis.addEventListener('pointerdown', onPointerDown);
    globalThis.addEventListener('focusin', onFocusIn);
    return () => {
      globalThis.removeEventListener('pointerdown', onPointerDown);
      globalThis.removeEventListener('focusin', onFocusIn);
    };
  }, [isOpen, root, close]);
}
