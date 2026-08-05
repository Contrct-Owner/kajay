import type { CreatorWorkspace } from '@kajay/creator-core';
import { PageNavigatorPanel, useSurfaceVersion } from '@kajay/creator-react';
import type { useDesignerPlacement } from '@kajay/creator-react';
import { Redo2, Undo2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Undo, redo and the pages — one row.
 *
 * **The library's `HistoryPanel` is not used here**, and that is the seam working rather
 * than failing. It draws two labelled buttons, which is the right default for a host with
 * no toolbar of its own; this page has one, and wants icons in it. So it does what
 * [ADR-0021](../../../../../docs/adr/0021-creator-composition.md) invites — puts undo in its
 * own toolbar — by calling `surface.undo()` directly.
 *
 * That needs `useSurfaceVersion`, which the library kept private until this file wanted it.
 * Without a subscription the buttons could not tell when there stopped being anything to
 * undo, and a control that is enabled when it should not be is worse than no control.
 */
export function DesignerToolbar({
  workspace,
  placement,
}: {
  readonly workspace: CreatorWorkspace;
  readonly placement: ReturnType<typeof useDesignerPlacement>;
}): ReactElement {
  const { surface } = workspace;
  // Re-reads on every edit. `canUndo` is a getter over the history stack, so nothing
  // notices it changing without this.
  useSurfaceVersion(surface);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          data-testid="undo"
          // The label is what a screen reader gets and what a test finds; the icon is for
          // everyone who can see it. An icon button with neither is a mystery.
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
          disabled={!surface.canUndo}
          onClick={() => {
            surface.undo();
          }}
        >
          <Undo2 aria-hidden />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          data-testid="redo"
          aria-label="Redo"
          title="Redo (Ctrl+Shift+Z)"
          disabled={!surface.canRedo}
          onClick={() => {
            surface.redo();
          }}
        >
          <Redo2 aria-hidden />
        </Button>
      </div>
      <PageNavigatorPanel surface={surface} placement={placement} />
    </div>
  );
}
