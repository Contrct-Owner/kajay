import type { SurveyDefinition } from '@kajay/core';

export type DemoRuntimeName = 'dotnet' | 'typescript' | 'compare';

export interface DemoComparison {
  readonly matched: boolean;
  readonly differences: readonly string[];
}

export interface DemoDiagnostic {
  readonly code: string;
  readonly path: string;
  readonly severity: 'error' | 'warning';
  readonly message: string;
}

export interface DemoDefinitionResult {
  readonly runtime: DemoRuntimeName;
  readonly accepted: boolean;
  readonly definition?: SurveyDefinition;
  readonly diagnostics: readonly DemoDiagnostic[];
  readonly comparison?: DemoComparison;
}

export interface DemoSubmissionError {
  readonly name: string;
  readonly kind: string;
  readonly message: string;
  readonly path: string;
}

export interface DemoQuizScore {
  readonly earned: number;
  readonly possible: number;
  readonly questionCount: number;
  readonly ratio: number;
}

export interface DemoSubmissionResult {
  readonly runtime: DemoRuntimeName;
  readonly accepted: boolean;
  readonly completed: boolean;
  readonly outcome: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly score: DemoQuizScore;
  readonly errors: readonly DemoSubmissionError[];
  readonly diagnostics: readonly DemoDiagnostic[];
  readonly comparison?: DemoComparison;
}

export interface DemoSnapshotResult {
  readonly runtime: DemoRuntimeName;
  readonly definitionDigest: string;
  readonly snapshot: Readonly<Record<string, unknown>>;
  readonly restoredData: Readonly<Record<string, unknown>>;
  readonly comparison?: DemoComparison;
}
