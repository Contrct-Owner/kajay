import { Toolbox } from '@kajay/creator-core';
import type { ToolboxItem } from '@kajay/creator-core';
import { ToolboxPanel } from '@kajay/creator-react';
import { useMemo, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';

/**
 * The Creator's toolbox, driven the way a host drives it — checklist K1.
 *
 * The demo builds the model, renders the piece, and does its own thing with what comes
 * back. Nothing here reaches inside the panel, which is the arrangement
 * [ADR-0021](../../../docs/adr/0021-creator-composition.md) exists to make possible:
 * this could be a sidebar in an application that already has one.
 *
 * The picked item is only reported here. Putting it on a page is K2 and K3.
 *
 * The theme variables are put on this section by the *host*, not by the panel. That is
 * the seam working as designed rather than a gap: `<Survey theme={…}>` scopes them to
 * one survey because two surveys on a page may be themed differently, and a Creator
 * piece sitting in a host's own sidebar is the same situation — the tokens are CSS
 * custom properties, and any element the host controls can carry them. A `theme` prop on
 * every piece would be the library doing badly what a style attribute already does.
 */
export interface DesignerToolboxProps {
  readonly theme: Readonly<Record<string, string>>;
}

export function DesignerToolbox({ theme }: DesignerToolboxProps): ReactElement {
  // Built once: it holds the search term, and rebuilding it per render would clear
  // what the designer typed on every keystroke.
  const toolbox = useMemo(() => new Toolbox(), []);
  const [picked, setPicked] = useState<ToolboxItem>();

  return (
    <section
      className="host-demo__panel"
      aria-label="Designer toolbox"
      style={theme as CSSProperties}
    >
      <h2>Toolbox</h2>
      <ToolboxPanel
        toolbox={toolbox}
        onPick={(item) => {
          setPicked(item);
        }}
      />
      <p data-testid="toolbox-picked">
        {picked === undefined ? 'Nothing picked yet.' : `Picked ${picked.type}.`}
      </p>
    </section>
  );
}
