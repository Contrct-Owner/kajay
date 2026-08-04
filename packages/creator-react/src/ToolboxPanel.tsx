import type { Toolbox, ToolboxItem } from '@kajay/creator-core';
import { useCallback, useSyncExternalStore } from 'react';
import type { ReactElement } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';
import type { CreatorStringKey } from '@kajay/creator-core';
import { useCreatorText } from './CreatorStringsContext.js';
import type { CreatorText } from './CreatorStringsContext.js';
import type { PlacementItemProps } from './useDesignerPlacement.js';

/**
 * Re-renders when the toolbox changes.
 *
 * `useSyncExternalStore` over the model's own event, the same integration the renderer
 * uses: the model owns the state, React only reads it. The snapshot is the version
 * counter rather than the categories, because `categories` builds a fresh array on
 * every read and this hook compares snapshots by identity.
 */
function useToolboxVersion(toolbox: Toolbox): number {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => toolbox.onChanged.add(onStoreChange),
    [toolbox],
  );
  const getSnapshot = useCallback((): number => toolbox.version, [toolbox]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

export interface ToolboxPanelProps {
  readonly toolbox: Toolbox;
  /** Told what to add. The panel never touches a survey itself. */
  readonly onPick?: (item: ToolboxItem) => void;
  /**
   * Makes an item draggable onto the canvas — checklist K2.
   *
   * Handed in as opaque props rather than as a design surface, so the toolbox still
   * knows nothing about where a drop lands. It supplies the *source* of a gesture and
   * has no opinion about its destination — including what a plain click means, which
   * comes back in the same object because only the gesture knows whether the click that
   * just arrived was the end of a drag.
   */
  readonly getItemProps?: ((item: ToolboxItem) => PlacementItemProps) | undefined;
  readonly className?: string;
}

/**
 * What a designer can add, and the box they search it with — checklist K1.
 *
 * **A piece, not a panel of a bigger thing** ([ADR-0021](../../../docs/adr/0021-creator-composition.md)):
 * it takes the model it needs and holds no state of its own, so a host can put it in a
 * sidebar their application already owns. It takes the *toolbox* rather than a whole
 * creator, which is the same guarantee with less coupling — the narrowest model that
 * answers the question.
 *
 * It draws itself out of the host's primitives where they supplied any
 * ([ADR-0022](../../../docs/adr/0022-design-system-primitives.md)), and out of ours
 * where they did not.
 *
 * Picking is reported, never performed. Where a picked item lands — a page, a selection,
 * an insertion index — is K2 and K3's business, and a toolbox that reached into a survey
 * would be the second thing deciding it.
 *
 * **Clicking an item is the whole interaction on its own.** A click reports the pick and
 * the host adds it; dragging only chooses *where*. That is what keeps K2 keyboard-
 * complete without inventing an aim-then-confirm mode nobody would find: everything a
 * drag can do is a click followed by the element's own grab-and-move, which a keyboard
 * user needs anyway.
 */
export function ToolboxPanel({
  toolbox,
  onPick,
  getItemProps,
  className,
}: ToolboxPanelProps): ReactElement {
  const { Input } = useCreatorComponents();
  const text = useCreatorText();
  useToolboxVersion(toolbox);
  const categories = toolbox.categories;

  return (
    <div className={joinClasses('kajay-toolbox', className)}>
      <Input
        type="search"
        className="kajay-toolbox__search"
        value={toolbox.search}
        onValueChange={(value) => {
          toolbox.setSearch(value);
        }}
        placeholder={text('toolboxSearchPlaceholder')}
        aria-label={text('toolboxSearch')}
      />

      {categories.length === 0 ? (
        // Said in words rather than left blank: an empty box after typing reads as a
        // broken toolbox, and a respondent — or here a designer — cannot tell the two
        // apart without being told.
        <p className="kajay-toolbox__empty" role="status">
          {text('toolboxNoMatches', toolbox.search)}
        </p>
      ) : null}

      {categories.map((category) => (
        <section className="kajay-toolbox__category" key={categoryTitle(text, category.name)}>
          <h3 className="kajay-toolbox__category-title">{categoryTitle(text, category.name)}</h3>
          <ul className="kajay-toolbox__list">
            {category.items.map((item) => (
              <ToolboxEntry
                key={item.name}
                item={item}
                onPick={onPick}
                getItemProps={getItemProps}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * One item.
 *
 * Its own component so the placement props are resolved once and the click can be
 * *composed* rather than overwritten: spreading them and then writing `onClick` would
 * silently drop the one that knows a drag just happened.
 */
function ToolboxEntry({
  item,
  onPick,
  getItemProps,
}: {
  readonly item: ToolboxItem;
  readonly onPick: ((item: ToolboxItem) => void) | undefined;
  readonly getItemProps: ((item: ToolboxItem) => PlacementItemProps) | undefined;
}): ReactElement {
  const { Button } = useCreatorComponents();
  const placement = getItemProps?.(item);

  return (
    <li className="kajay-toolbox__item">
      <Button
        className="kajay-toolbox__button"
        data-testid={`toolbox-${item.name}`}
        {...placement}
        onClick={() => {
          placement?.onClick();
          onPick?.(item);
        }}
      >
        {item.title}
      </Button>
    </li>
  );
}

function joinClasses(base: string, extra: string | undefined): string {
  return extra === undefined || extra.length === 0 ? base : `${base} ${extra}`;
}

/**
 * A built-in category's name in the designer's language — checklist N3.
 *
 * A *fallback*, not a lookup: a category the catalogue has never heard of keeps the word
 * the toolbox table gave it, which is how a host's own drawer keeps its own name. K1 said
 * these strings would stay English until this row; this is that promise kept without
 * taking away the host's ability to name a drawer whatever they like.
 */
function categoryTitle(text: CreatorText, name: string): string {
  const key = CATEGORY_KEYS[name];
  return key === undefined ? name : text(key);
}

const CATEGORY_KEYS: Readonly<Record<string, CreatorStringKey | undefined>> = {
  Text: 'categoryText',
  Choice: 'categoryChoice',
  Matrix: 'categoryMatrix',
  Panels: 'categoryPanels',
  Media: 'categoryMedia',
  Display: 'categoryDisplay',
  Other: 'categoryOther',
};
