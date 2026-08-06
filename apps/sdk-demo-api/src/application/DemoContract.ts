import type { SurveyDefinition } from '@kajay/core';

export interface DemoDiagnostic {
  readonly code: string;
  readonly path: string;
  readonly severity: 'error' | 'warning';
  readonly message: string;
}

export interface DemoDefinitionResult {
  readonly runtime: 'typescript';
  readonly accepted: boolean;
  readonly definition?: SurveyDefinition;
  readonly diagnostics: readonly DemoDiagnostic[];
}

export interface DemoSubmissionError {
  readonly name: string;
  readonly kind: string;
  readonly message: string;
  readonly path: string;
}

export interface DemoSubmissionResult {
  readonly runtime: 'typescript';
  readonly accepted: boolean;
  readonly completed: boolean;
  readonly outcome: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly score: {
    readonly earned: number;
    readonly possible: number;
    readonly questionCount: number;
    readonly ratio: number;
  };
  readonly errors: readonly DemoSubmissionError[];
  readonly diagnostics: readonly DemoDiagnostic[];
}

export interface DemoSnapshotResult {
  readonly runtime: 'typescript';
  readonly definitionDigest: string;
  readonly snapshot: Readonly<Record<string, unknown>>;
  readonly restoredData: Readonly<Record<string, unknown>>;
}
