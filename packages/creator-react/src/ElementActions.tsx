import type { DesignSurface } from '@kajay/creator-core';
import type { PageElement } from '@kajay/core';
import type { ReactElement } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';
import type { CreatorMenuItem } from './CreatorComponents.js';
import { useCreatorText } from './CreatorStringsContext.js';
import type { CreatorText } from './CreatorStringsContext.js';

export interface ElementActionsProps {
  readonly surface: DesignSurface;
  readonly element: PageElement;
  /**
   * Told that the designer asked to see this element's properties.
   *
   * **Reported, never performed** — the same rule the toolbox picks by. Where a property
   * grid *is* belongs to whoever laid the Creator out: a sidebar, a sheet, a separate
   * route, or nowhere at all. A menu item that tried to open one would be the piece
   * deciding a layout it cannot see.
   *
   * Absent means no such item, because an item that reports to nobody does nothing when
   * pressed. A host with the grid permanently on screen wants exactly that.
   */
  readonly onEditProperties?: ((elementName: string) => void) | undefined;
}

/**
 * Duplicate, copy, paste and delete — checklists K5, K7 and P4.
 *
 * **One menu, not four buttons.** They were a row, and a row is as wide as its actions
 * while the canvas is as wide as the host's layout gave it: in the reference application's
 * two-column playground the row ran straight over the element's right edge and across the
 * panel beside it. Collapsing them is the change; the actions are the same four.
 *
 * Shown only on the selected element, like K3's title editor and for the same reason: a
 * control on every question would bury the survey under the tools for editing it.
 *
 * They all act on the selection, which is what makes "paste" answerable — a paste has to
 * land somewhere, and the selected element is the only thing on screen that says where the
 * designer is working.
 */
export function ElementActions({
  surface,
  element,
  onEditProperties,
}: ElementActionsProps): ReactElement {
  const { Menu } = useCreatorComponents();
  const text = useCreatorText();
  const name = element.name;

  return (
    <Menu
      className="kajay-designer__menu"
      label={text('elementActions', name)}
      data-testid={`actions-${name}`}
      items={actionsFor(text, surface, name, onEditProperties !== undefined)}
      onSelect={(id) => {
        // Properties is the one item that is not a surface mutation, so it is answered
        // here rather than in `run`. The menu only exists on the *selected* element, so
        // the name handed back is always the current selection and a host has nothing to
        // reconcile.
        if (id === `properties-${name}`) {
          onEditProperties?.(name);
          return;
        }
        run(surface, name, id);
      }}
    />
  );
}

/**
 * What the menu offers, in the order a designer reaches for it.
 *
 * The ids carry the element name so they stay the `data-testid`s the suites already
 * address — `duplicate-who` is the same thing it was when it was a button, which is what
 * makes this a change of shape rather than of vocabulary.
 */
function actionsFor(
  text: CreatorText,
  surface: DesignSurface,
  name: string,
  canEditProperties: boolean,
): readonly CreatorMenuItem[] {
  return [
    // First, because it is the one a designer reaches for most and because it is a
    // different kind of thing from the four below it: those change the survey, this one
    // changes what you are looking at. Present or absent per *host*, not per interaction —
    // which is what keeps the paste argument below intact: the menu a designer learns is
    // the same menu every time they open it.
    ...(canEditProperties ? [{ id: `properties-${name}`, label: text('properties') }] : []),
    { id: `duplicate-${name}`, label: text('duplicate') },
    { id: `copy-${name}`, label: text('copy') },
    // Still listed while there is nothing to paste, and disabled. Hiding it would make the
    // menu a different length depending on history, which is how a designer loses the item
    // they were reaching for.
    { id: `paste-${name}`, label: text('paste'), isDisabled: !surface.canPaste },
    { id: `delete-${name}`, label: text('delete'), isDestructive: true },
  ];
}

function run(surface: DesignSurface, name: string, id: string): void {
  const action = id.slice(0, id.length - name.length - 1);
  switch (action) {
    case 'duplicate':
      surface.duplicate(name);
      return;
    case 'copy':
      surface.copy(name);
      return;
    case 'paste':
      surface.paste();
      return;
    default:
      surface.removeElement(name);
  }
}
