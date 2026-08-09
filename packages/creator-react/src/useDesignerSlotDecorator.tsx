import type { DesignSurface, DropSlot } from '@kajay/creator-core';
import type { PageElementSlotDecorator } from '@kajay/react';
import type { ReactNode } from 'react';
import { WITHDRAWN_ATTRIBUTE } from './placementGeometry.js';
import { PlacementPlaceholder } from './PlacementPlaceholder.js';
import type { DesignerPlacement } from './useDesignerPlacement.js';

/**
 * Draws the drop placeholder in whichever container it would land in — checklist K2.
 *
 * The counterpart of the element decorator that carries the adorner, and separate from it
 * because they wrap different things: an adorner belongs to an element and rides inside its
 * layout slot, while a placeholder belongs to the *container* and has to be one of its
 * cells. Only a decorator applied around the slot can produce the second, which is why
 * `@kajay/react` grew a seam for it — and, as with the first, a panel's children come
 * through it without `PanelRenderer` knowing anything has changed.
 *
 * **The withdrawn element keeps its DOM and gives up its space.** Unmounting it would be
 * the obvious way to take it out of the layout and would end the drag: the handle holding
 * the pointer capture is inside it. So the slot is wrapped in a node that is always there —
 * layout-transparent until it is asked to stand aside — and the stylesheet takes the cell
 * out of flow from outside it.
 */
export function useDesignerSlotDecorator(
  surface: DesignSurface,
  placement: DesignerPlacement | undefined,
  activeSlot: DropSlot | undefined,
): PageElementSlotDecorator {
  return (element, slot) => {
    const at = surface.locate(element.name);
    if (at === undefined || at.list.of !== 'elements') {
      return slot;
    }
    const container = at.list.container;
    const aimed =
      activeSlot !== undefined &&
      activeSlot.list.of === 'elements' &&
      activeSlot.list.container === container
        ? activeSlot.index
        : undefined;
    return (
      <>
        {aimed === at.index ? placeholder(placement, container, at.index) : null}
        <div
          className="kajay-designer__slot"
          {...(placement?.withdrawn === element.name ? { [WITHDRAWN_ATTRIBUTE]: 'true' } : {})}
        >
          {slot}
        </div>
        {/*
          The end of a container has no element to sit before, so its last element carries
          it instead. Without this the final position would be undrawable in every panel —
          and appending is the most common thing anybody does to a list.
        */}
        {aimed === at.index + 1 && isLast(surface, container, at.index)
          ? placeholder(placement, container, aimed)
          : null}
      </>
    );
  };
}

function placeholder(
  placement: DesignerPlacement | undefined,
  container: string,
  index: number,
): ReactNode {
  return (
    <PlacementPlaceholder
      className="kajay-designer__placeholder"
      shape={placement?.shape}
      container={container}
      index={index}
    />
  );
}

/**
 * Whether this element is the last thing in its container.
 *
 * Asked of the *model* rather than counted from what is on screen: the container's own
 * length is the thing an index is last in, and the DOM is a rendering of that answer
 * rather than a second source of it.
 */
function isLast(surface: DesignSurface, container: string, index: number): boolean {
  const siblings =
    surface.page?.name === container
      ? surface.page.elements
      : (surface.elementNamed(container)?.getChildren('elements') ?? []);
  return index === siblings.length - 1;
}
