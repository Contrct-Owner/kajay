import type { DefinitionDiagnosticCode } from './DiagnosticCode.js';

export type DiagnosticSeverity = 'error' | 'warning';

/**
 * A structured report about a definition. Unknown properties are *surfaced* here
 * rather than silently kept or silently dropped — checklist A1.
 */
export interface Diagnostic {
  readonly severity: DiagnosticSeverity;
  /** Stable machine-readable identifier, e.g. `unknown-property`. */
  readonly code: DefinitionDiagnosticCode;
  readonly message: string;
  /** JSON Pointer to the offending node, e.g. `/pages/0/elements/1`. */
  readonly path: string;
}
