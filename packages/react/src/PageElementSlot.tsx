import type { PageElement } from '@kajay/core';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
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

  return (
    <div
      className={className}
      data-element-slot={element.name}
      data-title-location={element.titleLocation === 'default' ? undefined : element.titleLocation}
      style={style as CSSProperties}
    >
      {children}
    </div>
  );
}
