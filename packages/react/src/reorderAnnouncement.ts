/** What just happened to a row someone is reordering. */
export type ReorderEventKind = 'grabbed' | 'moved' | 'dropped' | 'returned';

/**
 * What a live region says when a row is picked up, moved, dropped or put back.
 *
 * Its own function because these sentences are the *only* feedback a respondent who
 * cannot see the list gets: a row sliding past its neighbours is the whole interaction,
 * and it is entirely invisible to a screen reader. Every message states the position
 * and the total, because "moved down" tells someone the thing they already did and not
 * the thing they need to know.
 */
export function reorderAnnouncement(
  kind: ReorderEventKind,
  label: string,
  index: number,
  count: number,
): string {
  const at = `position ${String(index + 1)} of ${String(count)}`;
  switch (kind) {
    case 'grabbed':
      return `${label} grabbed, ${at}. Use the arrow keys to move it, then press space to drop it.`;
    case 'moved':
      return `${label}, ${at}.`;
    case 'dropped':
      return `${label} dropped at ${at}.`;
    case 'returned':
      return `Reordering cancelled. ${label} returned to ${at}.`;
  }
}
