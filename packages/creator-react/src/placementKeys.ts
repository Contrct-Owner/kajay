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
