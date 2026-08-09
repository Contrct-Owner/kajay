import type { DesignSurface } from '@kajay/creator-core';
import type { Page } from '@kajay/core';
import { Fragment } from 'react';
import type { ReactElement } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';
import { useCreatorText } from './CreatorStringsContext.js';
import { ELEMENT_INDEX_ATTRIBUTE, WITHDRAWN_ATTRIBUTE } from './placementGeometry.js';
import { PlacementPlaceholder } from './PlacementPlaceholder.js';
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
  const text = useCreatorText();
  const slot = placement?.activeSlot;
  const activeSlot = slot?.list.of === 'pages' ? slot.index : undefined;
  const pages = surface.pages;

  return (
    <div className={joinClasses('kajay-pages', className)}>
      <SurveyEntry surface={surface} />
      <ol className="kajay-pages__list" ref={placement?.pageListRef}>
        {pages.map((page, index) => (
          <Fragment key={page.name}>
            {activeSlot === index ? <PagePlaceholder placement={placement} index={index} /> : null}
            <PageEntry
              surface={surface}
              page={page}
              index={index}
              placement={placement}
              isWithdrawn={placement?.withdrawn === page.name}
            />
          </Fragment>
        ))}
        {/*
          The end of the list has no page to draw beside, and it is where a designer most
          often wants one. Inside the list rather than after it, so the row lays it out as
          one of its own — a marker outside would sit past the wrap rather than in it.
        */}
        {activeSlot === pages.length ? (
          <PagePlaceholder placement={placement} index={activeSlot} />
        ) : null}
      </ol>
      <Button
        className="kajay-pages__add"
        data-testid="add-page"
        onClick={() => {
          surface.addPage();
        }}
      >
        {text('addPage')}
      </Button>
    </div>
  );
}

/**
 * The survey settings surface — checklist L5.
 *
 * It lives in the page navigator rather than in a piece of its own because this is where
 * the survey's *shape* is drawn, and the survey is the root of it: a designer looking for
 * "the whole survey" looks at the list of what it contains.
 *
 * **Selecting, not navigating**, so it carries no `aria-current`. The canvas still shows a
 * page; what changes is what the grid is editing — and saying "current" about something
 * nobody has navigated to would be the one claim this list must not get wrong.
 */
function SurveyEntry({ surface }: { readonly surface: DesignSurface }): ReactElement {
  const { Button } = useCreatorComponents();
  const text = useCreatorText();

  return (
    <Button
      className="kajay-pages__survey"
      data-selected={surface.selection.isSurvey ? 'true' : undefined}
      data-testid="select-survey"
      onClick={() => {
        surface.selectSurvey();
      }}
    >
      {text('surveySettings')}
    </Button>
  );
}

/**
 * The place a dragged page would take, as a row of the list.
 *
 * A list item rather than a bare marker, because it is going in an `<ol>` and the row it
 * joins is that list's own layout. `aria-hidden` puts it back out of the list a screen
 * reader hears, where an unnamed entry would be one more thing to step past while the
 * live region is already saying where the page has got to.
 */
function PagePlaceholder({
  placement,
  index,
}: {
  readonly placement: DesignerPlacement | undefined;
  readonly index: number;
}): ReactElement {
  return (
    <li className="kajay-pages__placeholder-row" aria-hidden="true">
      <PlacementPlaceholder
        className="kajay-pages__placeholder"
        shape={placement?.shape}
        index={index}
      />
    </li>
  );
}

interface PageEntryProps {
  readonly surface: DesignSurface;
  readonly page: Page;
  readonly index: number;
  readonly placement: DesignerPlacement | undefined;
  readonly isWithdrawn?: boolean;
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
  isWithdrawn,
}: PageEntryProps): ReactElement {
  const { Button } = useCreatorComponents();
  const isCurrent = surface.page?.name === page.name;
  const label = page.title.length > 0 ? page.title : page.name;

  return (
    <li
      className="kajay-pages__item"
      data-current={isCurrent ? 'true' : undefined}
      // What identifies this row across a reorder, so it can be *moved* into its new
      // position rather than redrawn there. An index cannot: reordering is precisely the
      // operation that changes it, so every row would look like a different row.
      data-page-name={page.name}
      {...{
        [ELEMENT_INDEX_ATTRIBUTE]: String(index),
        // Standing aside, not unmounted: the handle inside it is holding the pointer
        // capture that is driving the drag, and removing it would end the gesture.
        ...(isWithdrawn === true ? { [WITHDRAWN_ATTRIBUTE]: 'true' } : {}),
      }}
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
  const text = useCreatorText();

  return (
    <>
      {placement === undefined ? null : (
        <Button
          className="kajay-pages__handle"
          aria-label={text('moveElement', label)}
          data-testid={`move-page-${page.name}`}
          {...placement.getPageHandleProps(page.name, index)}
        >
          ⠿
        </Button>
      )}
      <Button
        className="kajay-pages__remove"
        aria-label={text('deleteElement', label)}
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
