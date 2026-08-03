import type { DesignSurface } from '@kajay/creator-core';
import type { Page } from '@kajay/core';
import type { ReactElement } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';
import { ELEMENT_INDEX_ATTRIBUTE } from './placementGeometry.js';
import { useSurfaceVersion } from './useSurfaceVersion.js';
import type { DesignerPlacement } from './useDesignerPlacement.js';

export interface PageNavigatorPanelProps {
  readonly surface: DesignSurface;
  /** Drag reordering, from {@link useDesignerPlacement} — checklist K4. */
  readonly placement?: DesignerPlacement | undefined;
  readonly className?: string;
}

/**
 * The survey's pages: which one is on the canvas, and the means to change that — K4.
 *
 * A piece ([ADR-0021](../../../docs/adr/0021-creator-composition.md)), like the toolbox
 * and the canvas: it takes the surface and holds nothing, so a host can put it in a rail,
 * a tab strip, or a drawer their application already has.
 *
 * **Reordering here is the same gesture as reordering questions**, down to the sentences
 * in the live region — the slot simply names a different list. That is what stopped page
 * management needing a second drag implementation, and with it a second copy of the
 * off-by-one that a mutant had already survived once.
 */
export function PageNavigatorPanel({
  surface,
  placement,
  className,
}: PageNavigatorPanelProps): ReactElement {
  useSurfaceVersion(surface);
  const { Button } = useCreatorComponents();
  const slot = placement?.activeSlot;
  const activeSlot = slot?.list.of === 'pages' ? slot.index : undefined;
  const pages = surface.pages;

  return (
    <div className={joinClasses('kajay-pages', className)}>
      <ol className="kajay-pages__list" ref={placement?.pageListRef}>
        {pages.map((page, index) => (
          <PageEntry
            key={page.name}
            surface={surface}
            page={page}
            index={index}
            placement={placement}
            isDropTarget={activeSlot === index}
          />
        ))}
      </ol>
      {activeSlot === pages.length ? (
        // The end of the list has no page to draw a line above, and it is where a
        // designer most often wants one.
        <div className="kajay-pages__drop-end" data-testid="page-drop-at-end" />
      ) : null}
      <Button
        className="kajay-pages__add"
        data-testid="add-page"
        onClick={() => {
          surface.addPage();
        }}
      >
        Add page
      </Button>
    </div>
  );
}

interface PageEntryProps {
  readonly surface: DesignSurface;
  readonly page: Page;
  readonly index: number;
  readonly placement: DesignerPlacement | undefined;
  readonly isDropTarget?: boolean;
}

/**
 * One page: go to it, move it, delete it.
 *
 * The page adorner. `title || name` because a page's title is genuinely optional — a
 * page with none renders without one for a respondent (E1), and a blank row here would
 * be unreachable by name for anybody navigating by voice or by screen reader.
 */
function PageEntry({
  surface,
  page,
  index,
  placement,
  isDropTarget,
}: PageEntryProps): ReactElement {
  const { Button } = useCreatorComponents();
  const isCurrent = surface.page?.name === page.name;
  const label = page.title.length > 0 ? page.title : page.name;

  return (
    <li
      className="kajay-pages__item"
      data-current={isCurrent ? 'true' : undefined}
      data-drop-before={isDropTarget ? 'true' : undefined}
      {...{ [ELEMENT_INDEX_ATTRIBUTE]: String(index) }}
    >
      <Button
        className="kajay-pages__go"
        // `aria-current` rather than colour alone: which page is open is the single
        // most important thing this list says, and it must survive being read aloud.
        aria-current={isCurrent ? 'page' : undefined}
        data-testid={`go-to-${page.name}`}
        onClick={() => {
          surface.goToPage(page.name);
        }}
      >
        {label}
      </Button>
      <PageControls surface={surface} page={page} index={index} placement={placement} label={label} />
    </li>
  );
}

/**
 * Move it, delete it.
 *
 * Deleting is on each page rather than on a selection, because a page a designer wants
 * gone is usually one they are *not* looking at, and making them navigate to it first
 * would put a step in front of the only thing they wanted.
 */
function PageControls({
  surface,
  page,
  index,
  placement,
  label,
}: PageEntryProps & { readonly label: string }): ReactElement {
  const { Button } = useCreatorComponents();

  return (
    <>
      {placement === undefined ? null : (
        <Button
          className="kajay-pages__handle"
          aria-label={`Move ${label}`}
          data-testid={`move-page-${page.name}`}
          {...placement.getPageHandleProps(page.name, index)}
        >
          ⠿
        </Button>
      )}
      <Button
        className="kajay-pages__remove"
        aria-label={`Delete ${label}`}
        data-testid={`remove-${page.name}`}
        onClick={() => {
          surface.removePage(page.name);
        }}
      >
        ×
      </Button>
    </>
  );
}

function joinClasses(base: string, extra: string | undefined): string {
  return extra === undefined || extra.length === 0 ? base : `${base} ${extra}`;
}
