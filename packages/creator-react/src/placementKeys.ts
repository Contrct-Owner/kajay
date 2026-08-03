/** What a key press means while something is being placed — checklist K2. */
export type PlacementIntent = 'toggle' | 'cancel' | 'previous' | 'next' | 'first' | 'last';

/**
 * The ranking question's grammar, deliberately unchanged.
 *
 * A grab mode rather than a modifier chord, for the reason C9 chose one: pressing space
 * on something and being told "grabbed, use the arrow keys" teaches the whole
 * interaction, where a chord is discoverable only by already knowing it. Both axes are
 * accepted because the canvas is a column here and two columns elsewhere, and nobody
 * should have to work out which before pressing a key.
 */
export function placementIntent(key: string): PlacementIntent | undefined {
  switch (key) {
    case ' ':
    case 'Enter':
      return 'toggle';
    case 'Escape':
      return 'cancel';
    case 'ArrowUp':
    case 'ArrowLeft':
      return 'previous';
    case 'ArrowDown':
    case 'ArrowRight':
      return 'next';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    default:
      return undefined;
  }
}

/**
 * The next slot in a direction, skipping the ones that would change nothing.
 *
 * **An element sits between two slots that mean the same thing.** A question at index 1
 * is both "after index 0" and "before index 2"; dropping it in either puts it back
 * exactly where it started. Stepping one slot at a time without knowing that would make
 * the first press of ArrowDown appear to do nothing at all, which reads as a broken
 * key rather than as a subtlety of indices.
 *
 * `origin` is `undefined` for something that is not on the canvas yet — nothing is a
 * no-op for a new element, because every slot is somewhere it is not.
 */
export function stepSlot(
  slot: number,
  intent: PlacementIntent,
  origin: number | undefined,
  count: number,
): number {
  const delta = intent === 'previous' ? -1 : 1;
  const target = boundary(slot, intent, delta, count);
  const skipped = isNoOp(target, origin) ? target + delta : target;
  return Math.min(Math.max(skipped, 0), count);
}

function boundary(slot: number, intent: PlacementIntent, delta: number, count: number): number {
  switch (intent) {
    case 'first':
      return 0;
    case 'last':
      return count;
    default:
      return slot + delta;
  }
}

function isNoOp(slot: number, origin: number | undefined): boolean {
  return origin !== undefined && (slot === origin || slot === origin + 1);
}
