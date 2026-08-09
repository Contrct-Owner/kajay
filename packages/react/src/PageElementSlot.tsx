import type { PageElement } from '@kajay/core';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { usePageElementDecorator } from './PageElementDecoratorContext.js';
import { usePageElementSlotDecorator } from './PageElementSlotDecoratorContext.js';
import { useCssClass } from './SurveyCssContext.js';

export interface PageElementSlotProps {
  readonly element: PageElement;
  readonly children: ReactNode;
}

/**
 * The place an element sits in its container's layout — checklist I5.
 *
 * One wrapper around every page element, which is what makes the layout properties a
 * single implementation rather than a rule each of twenty renderers has to remember —
 * and what gives a host's own class (I4) somewhere to go without any renderer knowing
 * about it.
 *
 * `startWithNewLine` is a grid *start*, not a break element: a break would be a node in
 * the tree that means nothing to a screen reader and has to be skipped by every
 * traversal.
 */
export function PageElementSlot({ element, children }: PageElementSlotProps): ReactElement {
  const className = useCssClass('element', 'kajay-element');
  // Whatever a host has wrapped page elements in — nothing, for a respondent. This is
  // how the Creator gets an adorner around an element inside a panel without any
  // renderer knowing the Creator exists.
  const decorate = usePageElementDecorator();
  // And whatever a host has drawn *beside* the slot — nothing, for a respondent. This is
  // how the Creator puts a drop placeholder in a container's own layout without any
  // renderer knowing the Creator exists.
  const decorateSlot = usePageElementSlotDecorator();
  const style: Record<string, string> = {};
  if (element.startWithNewLine) {
    style['gridColumnStart'] = '1';
  }
  if (element.width.length > 0) {
    style['width'] = element.width;
  }
  if (element.minWidth.length > 0) {
    style['minWidth'] = element.minWidth;
  }

  const slot = (
    <div
      className={className}
      data-element-slot={element.name}
      data-title-location={element.titleLocation === 'default' ? undefined : element.titleLocation}
      style={style as CSSProperties}
    >
      {decorate(element, children)}
    </div>
  );

  // The fragment is unconditional so the slot keeps its position among whatever the
  // decorator draws beside it. A decorator that appeared and disappeared *around* the
  // slot would remount the element on every change — which, mid-drag, destroys the very
  // handle holding the pointer capture that is driving the drag.
  return <>{decorateSlot(element, slot)}</>;
}
