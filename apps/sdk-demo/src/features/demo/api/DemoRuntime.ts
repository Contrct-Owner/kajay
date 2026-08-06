import type { SurveyDefinition } from '@kajay/core';
import type {
  DemoDefinitionResult,
  DemoRuntimeName,
  DemoSubmissionError,
  DemoSubmissionResult,
} from './DemoRuntimeTypes.js';

/** The narrow host-facing capability implemented by both SDK demonstrations. */
export interface DemoRuntime {
  readonly name: DemoRuntimeName;
  loadDefinition(): Promise<DemoDefinitionResult>;
  validateDefinition(definition: SurveyDefinition): Promise<DemoDefinitionResult>;
  validateAnswers(
    data: Readonly<Record<string, unknown>>,
    questionNames: readonly string[],
  ): Promise<readonly DemoSubmissionError[]>;
  submit(
    definition: SurveyDefinition,
    data: Readonly<Record<string, unknown>>,
  ): Promise<DemoSubmissionResult>;
}
