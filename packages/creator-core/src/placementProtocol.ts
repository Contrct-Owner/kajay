import type { DropSlot, PlacementSource } from './placement.js';
import type { PlacementDirection, PlacementNarration } from './PlacementSession.js';

/**
 * What a drag *is* at any moment, and what can be asked of it — checklist K2.
 *
 * Its own file because these two are the session's protocol rather than its behaviour: a
 * keyboard adapter, a pointer adapter and a test all speak this vocabulary without caring
 * how the state machine is written, and `PlacementSession` had outgrown one file holding
 * both.
 */
export type PlacementSnapshot =

  | {
      readonly kind: 'idle';
      readonly source: undefined;
      readonly origin: undefined;
      readonly activeSlot: undefined;
      readonly withdrawn: undefined;
      readonly narration: PlacementNarration | undefined;
    }
  | {
      readonly kind: 'preview';
      readonly source: PlacementSource;
      readonly origin: DropSlot | undefined;
      /** Present only when committing this slot would change the definition. */
      readonly activeSlot: DropSlot | undefined;
      /**
       * The element that gives up its place while this preview stands, if any.
       *
       * A view drawing the drop where it would land has to take it from where it is, or
       * the same question is on screen twice and the layout it shows is one the commit
       * will never produce. Absent whenever `activeSlot` is — an aim at a forbidden or
       * no-op position must leave the element exactly where it sits, because "nothing
       * would happen" and "your question has vanished" are not the same answer.
       */
      readonly withdrawn: string | undefined;
      readonly narration: PlacementNarration;
    };

export type PlacementCommand =
  | { readonly kind: 'place'; readonly source: PlacementSource; readonly slot: DropSlot }
  | {
      readonly kind: 'start';
      readonly source: PlacementSource;
      readonly slot?: DropSlot | undefined;
    }
  | { readonly kind: 'aim'; readonly slot: DropSlot | undefined }
  | { readonly kind: 'step'; readonly direction: PlacementDirection }
  | { readonly kind: 'finish'; readonly action: 'commit' | 'abandon' };
