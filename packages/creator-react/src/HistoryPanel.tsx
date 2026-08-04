import type { DesignSurface } from '@kajay/creator-core';
import type { ReactElement } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';
import { useCreatorText } from './CreatorStringsContext.js';
import { useSurfaceVersion } from './useSurfaceVersion.js';

export interface HistoryPanelProps {
  readonly surface: DesignSurface;
  readonly className?: string;
}

/**
 * Undo and redo — checklist K6.
 *
 * A piece ([ADR-0021](../../../docs/adr/0021-creator-composition.md)): a host that
 * already has a toolbar puts these in it, and one that does not gets two buttons.
 *
 * Buttons as well as the keyboard shortcut, and not only for discoverability: a button
 * says whether there is anything to undo. `Ctrl+Z` on an empty stack does nothing and
 * looks identical to `Ctrl+Z` on a broken one.
 */
export function HistoryPanel({ surface, className }: HistoryPanelProps): ReactElement {
  useSurfaceVersion(surface);
  const { Button } = useCreatorComponents();
  const text = useCreatorText();

  return (
    <div className={className === undefined ? 'kajay-history' : `kajay-history ${className}`}>
      <Button
        className="kajay-history__undo"
        data-testid="undo"
        disabled={!surface.canUndo}
        title="Undo (Ctrl+Z)"
        onClick={() => {
          surface.undo();
        }}
      >
        {text('undo')}
      </Button>
      <Button
        className="kajay-history__redo"
        data-testid="redo"
        disabled={!surface.canRedo}
        title="Redo (Ctrl+Shift+Z)"
        onClick={() => {
          surface.redo();
        }}
      >
        {text('redo')}
      </Button>
    </div>
  );
}
