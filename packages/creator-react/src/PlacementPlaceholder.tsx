import type { CSSProperties, ReactElement } from 'react';
import type { PlacementShape } from './placementShape.js';

export interface PlacementPlaceholderProps {
  /** The block the surface styles it as: the canvas and the page list differ. */
  readonly className: string;
  /** What is being placed, and how much room it needs. */
  readonly shape: PlacementShape | undefined;
  /** The container it would land in, absent for the survey's page list. */
  readonly container?: string | undefined;
  /** The index it would take in that container. */
  readonly index: number;
}

/**
 * Where the drop would land, drawn as the thing that would land there — checklist K2.
 *
 * **It occupies the slot rather than pointing at it.** The line this replaced could only
 * say "between these two", which a single column makes unambiguous and a `colCount: 2`
 * page does not: the geometry has always decided left-or-right as readily as above-or-below
 * (`slotAtPoint`), and a horizontal rule cannot draw the answer. A placeholder that takes a
 * cell can, because the container's own layout puts it in the right one and moves
 * everything else out of its way. That reflow *is* the indicator — the designer sees the
 * page they are about to have.
 *
 * Rendered from `activeSlot` like the line before it, so a keyboard walk and a pointer
 * drag produce the same picture, and a test can assert the picture without pixels
 * ([ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md) decision 2).
 *
 * **`aria-hidden`, deliberately.** Every position this takes is already spoken into the
 * live region, in sentences the ranking question shares; a second voice reading a label
 * that is a copy of one already on screen would make a keyboard drag noisier without
 * saying anything new.
 */
export function PlacementPlaceholder({
  className,
  shape,
  container,
  index,
}: PlacementPlaceholderProps): ReactElement {
  // The measured height goes on a custom property rather than `height` directly, so the
  // stylesheet keeps the final say — a theme with a minimum, or one that would rather draw
  // a constant-height gap, changes one rule instead of needing this to render differently.
  const style =
    shape?.height === undefined ? undefined : { '--kajay-placeholder-height': `${shape.height}px` };

  return (
    <div
      className={className}
      data-testid="drop-placeholder"
      data-in-container={container}
      data-drop-index={String(index)}
      aria-hidden="true"
      style={style as CSSProperties | undefined}
    >
      <span className={`${className}-label`}>{shape?.label ?? ''}</span>
    </div>
  );
}
