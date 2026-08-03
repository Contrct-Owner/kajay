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
 * **A walk of a list of slots, not arithmetic on an index.** Once a panel became a place
 * a drop could land, "one slot further down" stopped being "index + 1" — the slot after
 * the one above a panel is the slot *inside* it. The Creator hands over every position on
 * the page in the order they are on screen, and this steps through that.
 *
 * An element sits between two slots that mean the same place: a question at index 1 is
 * both "after index 0" and "before index 2", and dropping it in either puts it back
 * exactly where it started. Stepping without knowing that would make the first press of
 * ArrowDown appear to do nothing at all, which reads as a broken key rather than as a
 * subtlety of indices.
 */
export function stepSlot<Slot>(
  slots: readonly Slot[],
  current: Slot | undefined,
  intent: PlacementIntent,
  isSame: (left: Slot, right: Slot) => boolean,
  isNoOp: (slot: Slot) => boolean,
): Slot | undefined {
  const at = current === undefined ? -1 : slots.findIndex((slot) => isSame(slot, current));
  const delta = intent === 'previous' ? -1 : 1;
  const from = intent === 'first' ? -1 : intent === 'last' ? slots.length : at;
  const step = intent === 'first' ? 1 : intent === 'last' ? -1 : delta;
  for (let next = from + step; next >= 0 && next < slots.length; next += step) {
    const candidate = slots[next]!;
    if (!isNoOp(candidate)) {
      return candidate;
    }
  }
  return current;
}
