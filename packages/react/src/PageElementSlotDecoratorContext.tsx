import type { PageElement } from '@kajay/core';
import { createContext, useContext } from 'react';
import type { ReactElement, ReactNode } from 'react';

/** Wraps an element's whole layout slot, and may draw beside it. */
export type PageElementSlotDecorator = (element: PageElement, slot: ReactNode) => ReactNode;

const identity: PageElementSlotDecorator = (_element, slot) => slot;

const PageElementSlotDecoratorContext = createContext<PageElementSlotDecorator>(identity);

export interface PageElementSlotDecoratorProviderProps {
  readonly decorate: PageElementSlotDecorator;
  readonly children: ReactNode;
}

/**
 * Lets something draw *beside* a page element, in its container's own layout.
 *
 * The sibling of `PageElementDecoratorProvider`, and deliberately a second seam rather
 * than a wider first one. That one wraps an element **inside** its layout slot, which is
 * where an adorner belongs: the adorner is part of the element, moves with it and takes
 * its width. This one wraps the slot **itself**, which is the only place a node can be
 * added that the container lays out as one of its own children.
 *
 * The Creator's drop placeholder is why it exists, and it could not have used the first
 * seam. A container here is a grid whose items are the slots (I5), so an indicator drawn
 * inside a slot is inside a cell — it can push that one element down but it cannot take a
 * cell of its own, and therefore cannot show a drop landing *beside* an element in a
 * `colCount: 2` page. Everything the Creator needs to say about where a drop lands is a
 * statement about the container's layout, so it has to be drawn as part of it.
 *
 * Applied by `PageElementSlot` for the same reason the first one is: that wrapper is
 * already the one place every page element passes through in every container, so a panel's
 * children get this without `PanelRenderer` knowing anything about it
 * ([ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md) decision 5).
 *
 * The default is identity, so a respondent's survey renders exactly as it did.
 */
export function PageElementSlotDecoratorProvider({
  decorate,
  children,
}: PageElementSlotDecoratorProviderProps): ReactElement {
  return (
    <PageElementSlotDecoratorContext.Provider value={decorate}>
      {children}
    </PageElementSlotDecoratorContext.Provider>
  );
}

export function usePageElementSlotDecorator(): PageElementSlotDecorator {
  return useContext(PageElementSlotDecoratorContext);
}
