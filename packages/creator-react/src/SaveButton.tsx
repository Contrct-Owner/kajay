import type { DesignSurface, SaveController, SaveState } from '@kajay/creator-core';
import { useCallback, useSyncExternalStore } from 'react';
import type { ReactElement } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';

export interface SaveButtonProps {
  readonly surface: DesignSurface;
  readonly saver: SaveController;
  readonly className?: string;
}

/** What the button says, and what a screen reader hears afterwards. */
const SAVE_LABELS: Readonly<Record<SaveState, string>> = {
  idle: 'Save',
  saving: 'Saving…',
  saved: 'Saved',
  failed: 'Save failed — try again',
};

/**
 * Saving, and saying what happened — checklist N1.
 *
 * A piece like the rest: it takes the surface and the controller and holds nothing.
 *
 * **What happened is announced, not only drawn.** A button whose label changes from "Save"
 * to "Saved" tells a sighted designer that the work is safe and tells nobody else, and
 * "failed" is the half that matters — a save that quietly did not happen is the one thing a
 * designer must never have to guess about.
 */
export function SaveButton({ surface, saver, className }: SaveButtonProps): ReactElement {
  useSaveVersion(saver);
  const { Button } = useCreatorComponents();
  const state = saver.state;

  return (
    <span className={joinClasses('kajay-creator__save', className)}>
      <Button
        className="kajay-creator__save-button"
        data-testid="creator-save"
        disabled={saver.isSaving}
        onClick={() => {
          saver.request(surface.definition);
        }}
      >
        {SAVE_LABELS[state]}
      </Button>
      <span
        className="kajay-creator__save-state"
        data-testid="creator-save-state"
        data-state={state}
        aria-live="polite"
        aria-atomic="true"
      >
        {state === 'idle' ? '' : SAVE_LABELS[state]}
      </span>
    </span>
  );
}

/** Re-renders when a save starts, finishes or fails. */
export function useSaveVersion(saver: SaveController): number {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => saver.onChanged.add(onStoreChange),
    [saver],
  );
  const getSnapshot = useCallback((): number => saver.version, [saver]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

function joinClasses(base: string, extra: string | undefined): string {
  return extra === undefined || extra.length === 0 ? base : `${base} ${extra}`;
}
