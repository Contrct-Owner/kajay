import type { DependencyError } from '../dependencies/DependencyError.js';
import type { ExpressionError } from '../expressions/ExpressionError.js';
import type { LogicDiagnostics, LogicRunResult } from './LogicEngine.js';

/**
 * Accumulates what a settle reported.
 *
 * A settle can run the engine more than once — a rule writing a value re-enters — so
 * results are gathered rather than replaced, and reset once per top-level settle
 * instead of once per run.
 */
export class LogicDiagnosticsCollector {
  #dependencyErrors: DependencyError[] = [];
  #expressionErrors: ExpressionError[] = [];

  reset(): void {
    this.#dependencyErrors = [];
    this.#expressionErrors = [];
  }

  record(result: LogicRunResult): void {
    this.#dependencyErrors.push(...result.dependencyErrors);
    this.#expressionErrors.push(...result.expressionErrors);
  }

  get current(): LogicDiagnostics {
    return { dependencyErrors: this.#dependencyErrors, expressionErrors: this.#expressionErrors };
  }
}
