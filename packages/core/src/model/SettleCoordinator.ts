import type { ValueChangedEvent } from '../events/SurveyEvents.js';
import { LogicDiagnosticsCollector } from '../logic/LogicDiagnosticsCollector.js';
import type { LogicDiagnostics, LogicRunResult } from '../logic/LogicEngine.js';

/**
 * Runs logic to completion, then releases everything it produced.
 *
 * Rule writes are returned to the dependency transaction rather than starting nested
 * settles. The guard remains for host callbacks reached through completion or navigation
 * events, so those callbacks cannot flush a half-settled model.
 */
export class SettleCoordinator {
  #isSettling = false;
  #pendingValues: ValueChangedEvent[] = [];
  readonly #diagnostics: LogicDiagnosticsCollector = new LogicDiagnosticsCollector();
  readonly #flush: (values: readonly ValueChangedEvent[]) => void;

  constructor(flush: (values: readonly ValueChangedEvent[]) => void) {
    this.#flush = flush;
  }

  get isSettling(): boolean {
    return this.#isSettling;
  }

  get diagnostics(): LogicDiagnostics {
    return this.#diagnostics.current;
  }

  /** Buffers an answer change until the model has finished settling. */
  queueValue(event: ValueChangedEvent): void {
    this.#pendingValues.push(event);
  }

  run(logic: () => LogicRunResult): void {
    if (this.#isSettling) {
      this.#diagnostics.record(logic());
      return;
    }
    this.#isSettling = true;
    this.#diagnostics.reset();
    try {
      this.#diagnostics.record(logic());
    } finally {
      this.#isSettling = false;
    }
    this.release();
  }

  /**
   * Releases buffered events.
   *
   * Public because an asynchronous choice load lands after the settle that asked for
   * it, so nothing else would flush what it produced.
   */
  release(): void {
    const values = this.#pendingValues;
    this.#pendingValues = [];
    this.#flush(values);
  }
}
