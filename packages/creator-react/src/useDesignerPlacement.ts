import type {
  DesignSurface,
  DropList,
  DropSlot,
  PlacementNarration,
  PlacementSource,
  ToolboxItem,
} from '@kajay/creator-core';
import { reorderAnnouncement } from '@kajay/react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { slotAtPoint } from './placementGeometry.js';
import { placementIntent } from './placementKeys.js';
import type { PlacementIntent } from './placementKeys.js';
import { shapeOfSource } from './placementShape.js';
import type { PlacementShape } from './placementShape.js';

/** Pointer handlers for anything draggable: a toolbox item, an element, a page. */
export interface PlacementDragProps {
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
}

/** Drag handlers plus the atomic click-to-append interaction for a toolbox item. */
export interface PlacementItemProps extends PlacementDragProps {
  readonly onClick: () => void;
}

/** Everything an element or page drag handle needs. */
export interface PlacementHandleProps extends PlacementDragProps {
  readonly 'aria-roledescription': string;
  readonly 'data-grabbed': 'true' | undefined;
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

export interface DesignerPlacement {
  readonly surfaceRef: (element: HTMLElement | null) => void;
  readonly pageListRef: (element: HTMLElement | null) => void;
  readonly source: PlacementSource | undefined;
  readonly activeSlot: DropSlot | undefined;
  /** The element standing aside while a preview shows where it would go. */
  readonly withdrawn: string | undefined;
  /** What the placeholder is holding a place for, measured when the drag began. */
  readonly shape: PlacementShape | undefined;
  readonly announcement: string;
  readonly getItemProps: (item: ToolboxItem) => PlacementItemProps;
  readonly getHandleProps: (elementName: string) => PlacementHandleProps;
  readonly getPageHandleProps: (pageName: string, index: number) => PlacementHandleProps;
}

interface Gesture {
  pending: boolean;
  dragged: boolean;
}

type ElementRef = { current: HTMLElement | null };

interface PlacementContext {
  readonly surface: DesignSurface;
  readonly measure: ElementRef;
  readonly gesture: { current: Gesture };
  readonly remember: (shape: PlacementShape) => void;
  readonly fixedList?: DropList | undefined;
}

/**
 * The React input adapter for creator-core's placement lifecycle.
 *
 * React owns pointer capture, DOM geometry and key translation. The surface owns the
 * source, origin, target policy, traversal, commit, abandon and narration facts, so a
 * second UI adapter receives exactly the same placement meaning.
 */
export function useDesignerPlacement(surface: DesignSurface): DesignerPlacement {
  const canvas = useRef<HTMLElement | null>(null);
  const pageList = useRef<HTMLElement | null>(null);
  const gesture = useRef<Gesture>({ pending: false, dragged: false });
  // Measured once, when the drag begins, and read for as long as it lasts. Re-measuring
  // as the pointer moves would measure an element that has already stood aside — the
  // placeholder would collapse to nothing the moment it did its job.
  const [shape, setShape] = useState<PlacementShape>();
  const snapshot = useSyncExternalStore(
    surface.placement.subscribe,
    (): typeof surface.placement.snapshot => surface.placement.snapshot,
  );
  const surfaceRef = useCallback((element: HTMLElement | null): void => {
    canvas.current = element;
  }, []);
  const pageListRef = useCallback((element: HTMLElement | null): void => {
    pageList.current = element;
  }, []);

  const onCanvas: PlacementContext = { surface, measure: canvas, gesture, remember: setShape };
  const inPageList: PlacementContext = {
    surface,
    measure: pageList,
    gesture,
    remember: setShape,
    fixedList: { of: 'pages' },
  };

  return {
    surfaceRef,
    pageListRef,
    source: snapshot.source,
    activeSlot: snapshot.activeSlot,
    withdrawn: snapshot.withdrawn,
    // Tied to the snapshot rather than cleared when a drag ends: a measurement that
    // outlives its drag is never read, and a state update to forget it would be a second
    // render on every drop for something nothing can see.
    shape: snapshot.kind === 'preview' ? shape : undefined,
    announcement: formatNarration(snapshot.narration),
    getItemProps: (item) => itemProps(onCanvas, item),
    getHandleProps: (name) => handleProps(onCanvas, name),
    getPageHandleProps: (name, _index) => handleProps(inPageList, name),
  };
}

function itemProps(context: PlacementContext, item: ToolboxItem): PlacementItemProps {
  const { surface } = context;
  const source: PlacementSource = { kind: 'new', item };
  return {
    ...dragProps(context, source),
    onClick: () => {
      const page = surface.page;
      if (!context.gesture.current.dragged && page !== undefined) {
        surface.placement.transition({
          kind: 'place',
          source,
          slot: {
            list: { of: 'elements', container: page.name },
            index: page.elements.length,
          },
        });
      }
    },
  };
}

function handleProps(context: PlacementContext, name: string): PlacementHandleProps {
  const source: PlacementSource = { kind: 'move', name };
  const snapshot = context.surface.placement.snapshot;
  return {
    ...dragProps(context, source),
    'aria-roledescription': 'Sortable item',
    'data-grabbed':
      snapshot.source?.kind === 'move' && snapshot.source.name === name ? 'true' : undefined,
    onKeyDown: (event) => {
      const intent = placementIntent(event.key);
      if (intent === undefined) {
        return;
      }
      event.preventDefault();
      applyIntent(context, intent, source, event.currentTarget);
    },
  };
}

/** A drag begins on movement, leaving a press available for focus and selection. */
function dragProps(context: PlacementContext, source: PlacementSource): PlacementDragProps {
  const { measure, gesture, surface } = context;
  return {
    onPointerDown: (event) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = { pending: true, dragged: false };
    },
    onPointerMove: (event) => {
      if (!gesture.current.pending || measure.current === null) {
        return;
      }
      gesture.current.dragged = true;
      const slot = slotAtPoint(
        measure.current,
        { x: event.clientX, y: event.clientY },
        context.fixedList,
      );
      const placement = surface.placement;
      if (slot === undefined) {
        if (placement.snapshot.kind === 'preview') {
          placement.transition({ kind: 'aim', slot: undefined });
        }
        return;
      }
      if (placement.snapshot.kind === 'idle') {
        context.remember(shapeOfSource(source, event.currentTarget));
        placement.transition({ kind: 'start', source, slot });
        return;
      }
      placement.transition({ kind: 'aim', slot });
    },
    onPointerUp: () => {
      gesture.current.pending = false;
      surface.placement.transition({ kind: 'finish', action: 'commit' });
    },
    onPointerCancel: () => {
      gesture.current.pending = false;
      surface.placement.transition({ kind: 'finish', action: 'abandon' });
    },
  };
}

function applyIntent(
  context: PlacementContext,
  intent: PlacementIntent,
  source: PlacementSource,
  from: HTMLElement,
): void {
  const placement = context.surface.placement;
  if (intent === 'cancel') {
    placement.transition({ kind: 'finish', action: 'abandon' });
    return;
  }
  if (intent === 'toggle') {
    if (placement.snapshot.kind === 'idle') {
      // Measured on the grab, before anything has stood aside, exactly as the pointer
      // path does — the two gestures have to produce the same placeholder or the keyboard
      // walk would show a different page from the one a drag shows.
      context.remember(shapeOfSource(source, from));
      placement.transition({ kind: 'start', source });
      return;
    }
    placement.transition({ kind: 'finish', action: 'commit' });
    return;
  }
  placement.transition({ kind: 'step', direction: intent });
}

function formatNarration(narration: PlacementNarration | undefined): string {
  if (narration === undefined) {
    return '';
  }
  const sentence = reorderAnnouncement(
    narration.kind,
    narration.label,
    narration.position,
    narration.total,
  );
  return narration.container === undefined
    ? sentence
    : `${sentence.trimEnd()} In ${narration.container}.`;
}
