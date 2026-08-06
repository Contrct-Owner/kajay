export type EventListener<TEvent> = (event: TEvent) => void;

const silenceDepth = new WeakMap<object, number>();

/** @internal Runs model rehydration without replaying events as respondent actions. */
export function silenceEvents(
  emitter: object,
  action: () => void,
): void {
  silenceDepth.set(emitter, (silenceDepth.get(emitter) ?? 0) + 1);
  try {
    action();
  } finally {
    const remaining = (silenceDepth.get(emitter) ?? 1) - 1;
    if (remaining === 0) silenceDepth.delete(emitter);
    else silenceDepth.set(emitter, remaining);
  }
}

/**
 * Minimal typed event source. Zero dependencies, synchronous delivery, no scheduler —
 * an adapter that wants frame-level batching does that at the adapter.
 */
export class EventEmitter<TEvent> {
  readonly #listeners: Set<EventListener<TEvent>> = new Set();

  /** Subscribes and returns an unsubscribe function. */
  add(listener: EventListener<TEvent>): () => void {
    this.#listeners.add(listener);
    return (): void => {
      this.#listeners.delete(listener);
    };
  }

  remove(listener: EventListener<TEvent>): void {
    this.#listeners.delete(listener);
  }

  /** Iterates a snapshot, so a listener may unsubscribe during delivery. */
  emit(event: TEvent): void {
    if ((silenceDepth.get(this) ?? 0) > 0) {
      return;
    }
    const snapshot = Array.from(this.#listeners);
    for (const listener of snapshot) {
      listener(event);
    }
  }

  get listenerCount(): number {
    return this.#listeners.size;
  }

}
