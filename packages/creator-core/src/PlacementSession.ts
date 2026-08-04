import type { SurveyDefinition } from '@kajay/core';
import { isTypeAllowed } from './CreatorConfiguration.js';
import type { CreatorConfiguration } from './CreatorConfiguration.js';
import { listOf, locate } from './definitionTree.js';
import { applyPlacement, canPlace, dropSlotsFor, dropSlotsOn, placedName } from './placement.js';
import type { DropSlot, PlacementSource } from './placement.js';
import {
  containsSlot,
  nextPlacementSlot,
  placementNarration,
  sameSlot,
} from './placementLifecycle.js';

export type PlacementDirection = 'previous' | 'next' | 'first' | 'last';
export type PlacementNarrationKind = 'grabbed' | 'moved' | 'dropped' | 'returned';
export type PlacementOutcome = 'updated' | 'committed' | 'refused' | 'ignored';

/** Stable accessibility facts. A UI adapter decides how to turn them into words. */
export interface PlacementNarration {
  readonly kind: PlacementNarrationKind;
  readonly label: string;
  /** Zero-based: the shared reorder formatter turns it into a spoken ordinal. */
  readonly position: number;
  readonly total: number;
  readonly container: string | undefined;
}

export type PlacementSnapshot =
  | {
      readonly kind: 'idle';
      readonly source: undefined;
      readonly origin: undefined;
      readonly activeSlot: undefined;
      readonly narration: PlacementNarration | undefined;
    }
  | {
      readonly kind: 'preview';
      readonly source: PlacementSource;
      readonly origin: DropSlot | undefined;
      /** Present only when committing this slot would change the definition. */
      readonly activeSlot: DropSlot | undefined;
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

export interface PlacementSession {
  readonly snapshot: PlacementSnapshot;
  readonly transition: (command: PlacementCommand) => PlacementOutcome;
  readonly subscribe: (listener: () => void) => () => void;
}

interface PlacementHost {
  readonly definition: () => SurveyDefinition;
  readonly revision: () => number;
  readonly pageName: () => string | undefined;
  readonly isContainerType: (type: string) => boolean;
  readonly isReadOnly: () => boolean;
  readonly configuration: () => CreatorConfiguration | undefined;
  readonly commit: (
    definition: SurveyDefinition,
    before: SurveyDefinition,
    select: string | undefined,
  ) => void;
}

const IDLE: PlacementSnapshot = {
  kind: 'idle',
  source: undefined,
  origin: undefined,
  activeSlot: undefined,
  narration: undefined,
};

/** The concrete headless placement lifecycle owned by a design surface. */
export class PlacementSessionModel implements PlacementSession {
  readonly #host: PlacementHost;
  readonly #listeners: Set<() => void> = new Set();
  #snapshot: PlacementSnapshot = IDLE;
  #target: DropSlot | undefined;
  #lastNarrationSlot: DropSlot | undefined;
  #startedAt = -1;

  constructor(host: PlacementHost) { this.#host = host; }

  get snapshot(): PlacementSnapshot { return this.#snapshot; }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return (): void => {
      this.#listeners.delete(listener);
    };
  };

  readonly transition = (command: PlacementCommand): PlacementOutcome => {
    switch (command.kind) {
      case 'place':
        return this.#place(command.source, command.slot);
      case 'start':
        return this.#start(command.source, command.slot);
      case 'aim':
        return this.#aim(command.slot);
      case 'step':
        return this.#step(command.direction);
      case 'finish':
        return command.action === 'commit' ? this.#commit() : this.#abandon();
    }
  };

  /** Invalidates a preview without publishing; the surface publishes after its change. */
  invalidate(): boolean {
    if (this.#snapshot.kind === 'idle') { return false; }
    this.#finishAsReturned();
    return true;
  }

  publish(): void {
    const listeners = Array.from(this.#listeners);
    for (const listener of listeners) {
      listener();
    }
  }

  #place(source: PlacementSource, slot: DropSlot): PlacementOutcome {
    if (this.#snapshot.kind !== 'idle') {
      return 'refused';
    }
    const before = this.#host.definition();
    if (!this.#sourceAllowed(source) || !canPlace(before, source, slot)) {
      return 'refused';
    }
    const after = applyPlacement(before, source, slot);
    const origin = source.kind === 'move' ? locate(before, source.name) : undefined;
    const narration = placementNarration('dropped', source, origin, slot, before);
    this.#setIdle(narration);
    this.#host.commit(after, before, placedName(source, after, slot));
    this.publish();
    return 'committed';
  }

  #start(source: PlacementSource, requested: DropSlot | undefined): PlacementOutcome {
    if (this.#snapshot.kind !== 'idle' || !this.#sourceAllowed(source)) {
      return 'refused';
    }
    const definition = this.#host.definition();
    const origin = source.kind === 'move' ? locate(definition, source.name) : undefined;
    if (source.kind === 'move' && origin === undefined) {
      return 'refused';
    }
    const slots = this.#slots(source, origin, definition);
    const target = requested ?? origin;
    if (target === undefined || !containsSlot(slots, target)) {
      return 'refused';
    }
    this.#target = target;
    this.#lastNarrationSlot = target;
    this.#startedAt = this.#host.revision();
    this.#snapshot = {
      kind: 'preview',
      source,
      origin,
      activeSlot: canPlace(definition, source, target) ? target : undefined,
      narration: placementNarration('grabbed', source, origin, target, definition),
    };
    this.publish();
    return 'updated';
  }

  #aim(slot: DropSlot | undefined): PlacementOutcome {
    const state = this.#snapshot;
    if (state.kind === 'idle') {
      return 'ignored';
    }
    const definition = this.#host.definition();
    if (this.#host.revision() !== this.#startedAt) {
      this.#finishAsReturned();
      this.publish();
      return 'refused';
    }
    if (slot === undefined) {
      if (this.#target === undefined) {
        return 'ignored';
      }
      this.#target = undefined;
      this.#snapshot = { ...state, activeSlot: undefined };
      this.publish();
      return 'updated';
    }
    if (!containsSlot(this.#slots(state.source, state.origin, definition), slot)) {
      return 'refused';
    }
    if (sameSlot(this.#target, slot)) {
      return 'ignored';
    }
    const allowed = canPlace(definition, state.source, slot);
    this.#target = slot;
    this.#lastNarrationSlot = slot;
    this.#snapshot = {
      ...state,
      activeSlot: allowed ? slot : undefined,
      narration: allowed
        ? placementNarration('moved', state.source, state.origin, slot, definition)
        : state.narration,
    };
    this.publish();
    return 'updated';
  }

  #step(direction: PlacementDirection): PlacementOutcome {
    const state = this.#snapshot;
    if (state.kind === 'idle') {
      return 'ignored';
    }
    const definition = this.#host.definition();
    if (this.#host.revision() !== this.#startedAt) {
      this.#finishAsReturned();
      this.publish();
      return 'refused';
    }
    const slots = this.#slots(state.source, state.origin, definition);
    const next = nextPlacementSlot(slots, this.#target, direction, (slot) =>
      canPlace(definition, state.source, slot),
    );
    return next === undefined || sameSlot(next, this.#target) ? 'ignored' : this.#aim(next);
  }

  #commit(): PlacementOutcome {
    const state = this.#snapshot;
    const target = this.#target;
    if (state.kind === 'idle') {
      return 'ignored';
    }
    if (target === undefined) {
      this.#finishAsReturned();
      this.publish();
      return 'refused';
    }
    const before = this.#host.definition();
    if (
      this.#host.revision() !== this.#startedAt ||
      !this.#sourceAllowed(state.source) ||
      !canPlace(before, state.source, target)
    ) {
      this.#finishAsReturned();
      this.publish();
      return 'refused';
    }
    const after = applyPlacement(before, state.source, target);
    const narration = placementNarration('dropped', state.source, state.origin, target, before);
    this.#setIdle(narration);
    this.#host.commit(after, before, placedName(state.source, after, target));
    this.publish();
    return 'committed';
  }

  #abandon(): PlacementOutcome {
    if (this.#snapshot.kind === 'idle') { return 'ignored'; }
    this.#finishAsReturned();
    this.publish();
    return 'updated';
  }

  #finishAsReturned(): void {
    const state = this.#snapshot;
    if (state.kind === 'idle') { return; }
    const at = state.origin ?? this.#target ?? this.#lastNarrationSlot;
    const narration = at === undefined
      ? state.narration
      : placementNarration('returned', state.source, state.origin, at, this.#host.definition());
    this.#setIdle(narration);
  }

  #setIdle(narration: PlacementNarration): void {
    this.#snapshot = { ...IDLE, narration };
    this.#target = undefined;
    this.#lastNarrationSlot = undefined;
    this.#startedAt = -1;
  }

  #sourceAllowed(source: PlacementSource): boolean {
    return !this.#host.isReadOnly() &&
      (source.kind === 'move' || isTypeAllowed(source.item.type, this.#host.configuration()));
  }

  #slots(
    source: PlacementSource,
    origin: DropSlot | undefined,
    definition: SurveyDefinition,
  ): readonly DropSlot[] {
    if (source.kind === 'move' && origin?.list.of === 'pages') {
      return dropSlotsFor({ of: 'pages' }, listOf(definition, { of: 'pages' })?.length ?? 0);
    }
    const page = this.#host.pageName();
    return page === undefined ? [] : dropSlotsOn(definition, page, this.#host.isContainerType);
  }
}
