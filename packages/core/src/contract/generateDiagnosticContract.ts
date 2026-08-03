import { DEPENDENCY_ERROR_DEFINITIONS } from '../dependencies/DependencyError.js';
import { EXPRESSION_ERROR_DEFINITIONS } from '../expressions/ExpressionErrorCode.js';
import { BUILT_IN_SURVEY_ERROR_KINDS } from '../model/SurveyErrorKind.js';
import { DEFINITION_DIAGNOSTIC_DEFINITIONS } from '../serialization/DiagnosticCode.js';

export const RUNTIME_DIAGNOSTIC_CONTRACT_VERSION: number = 1;

export interface RuntimeDiagnosticContract {
  readonly contractVersion: number;
  readonly definitionDiagnostics: readonly Readonly<Record<string, string>>[];
  readonly expressionErrors: readonly Readonly<Record<string, string>>[];
  readonly dependencyErrors: readonly Readonly<Record<string, string>>[];
  readonly surveyErrors: {
    readonly extensible: true;
    readonly builtInKinds: readonly Readonly<Record<string, string>>[];
  };
}

/** Stable machine-readable error vocabulary shared by every runtime implementation. */
export function generateDiagnosticContract(): RuntimeDiagnosticContract {
  return {
    contractVersion: RUNTIME_DIAGNOSTIC_CONTRACT_VERSION,
    definitionDiagnostics: DEFINITION_DIAGNOSTIC_DEFINITIONS,
    expressionErrors: EXPRESSION_ERROR_DEFINITIONS,
    dependencyErrors: DEPENDENCY_ERROR_DEFINITIONS,
    surveyErrors: {
      extensible: true,
      builtInKinds: BUILT_IN_SURVEY_ERROR_KINDS,
    },
  };
}
