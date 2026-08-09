import type {
  DesignSurface,
  DropSlot,
  PlacementNarration,
  PlacementSource,
  ToolboxItem,
} from '@kajay/creator-core';
import { reorderAnnouncement } from '@kajay/react';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import type { Point } from './ghostPosition.js';
import { handleProps, itemProps } from './placementGestures.js';
import type {
  Carry,
  ElementRef,
  Gesture,
  PlacementContext,
  PlacementHandleProps,
  PlacementItemProps,
} from './placementGestures.js';
import type { PlacementShape } from './placementShape.js';
import { useReleasedDrag } from './useReleasedDrag.js';
import { useSettledPlacement } from './useSettledPlacement.js';
import type { SettleSurface } from './useSettledPlacement.js';

export type {
  PlacementDragProps,
  PlacementHandleProps,
  PlacementItemProps,
} from './placementGestures.js';

/**
 * The two lists a placement rearranges, and what identifies their items across an edit.
 *
 * Names, not nodes: a structural edit re-parses and every element on the canvas is a new
 * one afterwards (ADR-0009 decision 3), so node identity cannot survive the drop that the
 * most important of these animations is *for*.
 */
const CANVAS_SURFACE = { selector: '[data-element-slot]', attribute: 'data-element-slot' };
const PAGE_SURFACE = { selector: '.kajay-pages__item', attribute: 'data-page-name' };

export interface DesignerPlacement {
  readonly surfaceRef: (element: HTMLElement | null) => void;
  readonly pageListRef: (element: HTMLElement | null) => void;
  readonly source: PlacementSource | undefined;
  readonly activeSlot: DropSlot | undefined;
  /** The element standing aside while a preview shows where it would go. */
  readonly withdrawn: string | undefined;
  /** What the placeholder is holding a place for, measured when the drag began. */
  readonly shape: PlacementShape | undefined;
  /**
   * What the pointer is carrying, for the ghost that follows it.
   *
   * Present only while a **pointer** is driving the drag. A keyboard walk has no pointer
   * for anything to follow, and a ghost parked in a corner of the screen through a
   * keyboard drag would be furniture rather than feedback.
   */
  readonly carrying: PlacementShape | undefined;
  /** Goes on the node drawn beside the pointer — see `PlacementGhost`. */
  readonly ghostRef: (element: HTMLElement | null) => void;
  readonly announcement: string;
  readonly getItemProps: (item: ToolboxItem) => PlacementItemProps;
  readonly getHandleProps: (elementName: string) => PlacementHandleProps;
  readonly getPageHandleProps: (pageName: string, index: number) => PlacementHandleProps;
}

/**
 * The React input adapter for creator-core's placement lifecycle.
 *
 * React owns pointer capture, DOM geometry and key translation. The surface owns the
 * source, origin, target policy, traversal, commit, abandon and narration facts, so a
 * second UI adapter receives exactly the same placement meaning.
 */
export function useDesignerPlacement(surface: DesignSurface): DesignerPlacement {
  const { canvas, pageList, ghost, gesture, anchor, grab } = usePlacementRefs();
  // Measured once, when the drag begins, and read for as long as it lasts. Re-measuring
  // as the pointer moves would measure an element that has already stood aside — the
  // placeholder would collapse to nothing the moment it did its job.
  const [shape, setShape] = useState<PlacementShape>();
  // Whether a *pointer* is driving this drag. The snapshot cannot say — a keyboard grab
  // and a pointer drag are the same placement to the model, and correctly so; what
  // differs is only whether there is a pointer for anything to follow.
  const [carrying, setCarrying] = useState(false);
  const snapshot = useSyncExternalStore(
    surface.placement.subscribe,
    (): typeof surface.placement.snapshot => surface.placement.snapshot,
  );
  const surfaces: readonly SettleSurface[] = [
    { node: canvas, ...CANVAS_SURFACE },
    { node: pageList, ...PAGE_SURFACE },
  ];
  const settle = useSettledPlacement(surfaces, ghost, snapshot.kind === 'idle');
  // The pointer half of a drag, undone. Kept apart from the transition it usually
  // accompanies because the window has to be able to do this for a handle that no longer
  // exists — see `useReleasedDrag`.
  const release = useCallback((): void => {
    gesture.current.pending = false;
    anchor.current = null;
    setCarrying(false);
  }, [gesture, anchor]);
  useReleasedDrag(surface, carrying, release);

  const carry: Carry = { node: ghost, anchor, grab, show: setCarrying };
  const onCanvas: PlacementContext = {
    surface,
    measure: canvas,
    gesture,
    remember: setShape,
    carry,
    settle,
  };
  const inPageList: PlacementContext = { ...onCanvas, measure: pageList, fixedList: { of: 'pages' } };

  return {
    surfaceRef: attach(canvas),
    pageListRef: attach(pageList),
    ghostRef: attach(ghost),
    source: snapshot.source,
    activeSlot: snapshot.activeSlot,
    withdrawn: snapshot.withdrawn,
    // Tied to the snapshot rather than cleared when a drag ends: a measurement that
    // outlives its drag is never read, and a state update to forget it would be a second
    // render on every drop for something nothing can see.
    shape: snapshot.kind === 'preview' ? shape : undefined,
    carrying: snapshot.kind === 'preview' && carrying ? shape : undefined,
    announcement: formatNarration(snapshot.narration),
    getItemProps: (item) => itemProps(onCanvas, item),
    getHandleProps: (name) => handleProps(onCanvas, name),
    getPageHandleProps: (name, _index) => handleProps(inPageList, name),
  };
}

/**
 * Every mutable handle the adapter keeps between renders.
 *
 * Together rather than scattered because they are one thing: what the browser handed us
 * last time, kept so the next pointer event can be answered without a render.
 */
function usePlacementRefs(): {
  readonly canvas: ElementRef;
  readonly pageList: ElementRef;
  readonly ghost: ElementRef;
  readonly gesture: { current: Gesture };
  readonly anchor: { current: Point | null };
  readonly grab: { current: Point };
} {
  return {
    canvas: useRef<HTMLElement | null>(null),
    pageList: useRef<HTMLElement | null>(null),
    ghost: useRef<HTMLElement | null>(null),
    gesture: useRef<Gesture>({ pending: false, dragged: false }),
    anchor: useRef<Point | null>(null),
    grab: useRef<Point>({ x: 0, y: 0 }),
  };
}

/**
 * A ref callback that only records the node.
 *
 * Not memoised, and it does not need to be: React detaches and re-attaches a changed
 * callback ref during commit, which for a function whose whole body is an assignment costs
 * one null and one node — and no pointer event can arrive in between.
 */
function attach(ref: ElementRef): (element: HTMLElement | null) => void {
  return (element) => {
    ref.current = element;
  };
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
