export type EventListener<TEvent> = (event: TEvent) => void;

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
    const snapshot = Array.from(this.#listeners);
    for (const listener of snapshot) {
      listener(event);
    }
  }

  get listenerCount(): number {
    return this.#listeners.size;
  }
}
