import type { Toolbox, ToolboxItem } from '@kajay/creator-core';
import { useCallback, useSyncExternalStore } from 'react';
import type { ReactElement } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';

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
 */
export function ToolboxPanel({ toolbox, onPick, className }: ToolboxPanelProps): ReactElement {
  const { Button, Input } = useCreatorComponents();
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
        placeholder="Search"
        aria-label="Search the toolbox"
      />

      {categories.length === 0 ? (
        // Said in words rather than left blank: an empty box after typing reads as a
        // broken toolbox, and a respondent — or here a designer — cannot tell the two
        // apart without being told.
        <p className="kajay-toolbox__empty" role="status">
          {`Nothing matches “${toolbox.search}”.`}
        </p>
      ) : null}

      {categories.map((category) => (
        <section className="kajay-toolbox__category" key={category.name}>
          <h3 className="kajay-toolbox__category-title">{category.name}</h3>
          <ul className="kajay-toolbox__list">
            {category.items.map((item) => (
              <li className="kajay-toolbox__item" key={item.name}>
                <Button
                  className="kajay-toolbox__button"
                  data-testid={`toolbox-${item.name}`}
                  onClick={() => {
                    onPick?.(item);
                  }}
                >
                  {item.title}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function joinClasses(base: string, extra: string | undefined): string {
  return extra === undefined || extra.length === 0 ? base : `${base} ${extra}`;
}
