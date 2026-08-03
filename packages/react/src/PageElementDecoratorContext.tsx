import type { PageElement } from '@kajay/core';
import { createContext, useContext } from 'react';
import type { ReactElement, ReactNode } from 'react';

/** Wraps one page element, wherever it sits. */
export type PageElementDecorator = (element: PageElement, children: ReactNode) => ReactNode;

const identity: PageElementDecorator = (_element, children) => children;

const PageElementDecoratorContext = createContext<PageElementDecorator>(identity);

export interface PageElementDecoratorProviderProps {
  readonly decorate: PageElementDecorator;
  readonly children: ReactNode;
}

/**
 * Lets something wrap every page element the renderers draw — checklist K2's nesting.
 *
 * It exists because the Creator needs to put an adorner around elements *inside a panel*,
 * and a panel's children are drawn by the respondent's own panel renderer, in markup the
 * Creator does not own. The alternatives were both worse: re-implementing the panel
 * renderer for design mode would be two panel layouts to keep in step, and threading a
 * "designMode" flag through every renderer would make each of twenty of them know about
 * the Creator.
 *
 * `PageElementSlot` is where it applies, which is why this is a small addition rather
 * than a new seam: that wrapper is *already* the one place every page element passes
 * through in every container ([ADR-0019](../../../docs/adr/0019-deep-runtime-modules-and-rendering-seam.md)).
 *
 * The default is identity, so a respondent's survey renders exactly as it did.
 */
export function PageElementDecoratorProvider({
  decorate,
  children,
}: PageElementDecoratorProviderProps): ReactElement {
  return (
    <PageElementDecoratorContext.Provider value={decorate}>
      {children}
    </PageElementDecoratorContext.Provider>
  );
}

export function usePageElementDecorator(): PageElementDecorator {
  return useContext(PageElementDecoratorContext);
}
