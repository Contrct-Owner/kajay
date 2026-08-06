import type { SurveyDefinition } from '@kajay/core';
import type {
  DemoDefinitionResult,
  DemoDiagnostic,
  DemoQuizScore,
  DemoRuntimeName,
  DemoSubmissionError,
  DemoSubmissionResult,
} from './DemoRuntimeTypes.js';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRuntime(value: unknown): DemoRuntimeName {
  if (value === 'dotnet' || value === 'typescript' || value === 'compare') return value;
  throw new TypeError('Demo response has an unsupported runtime.');
}

function readDiagnostic(value: unknown): DemoDiagnostic {
  if (!isObject(value)) throw new TypeError('Demo diagnostic must be an object.');
  const { code, path, severity, message } = value;
  if (
    typeof code !== 'string' ||
    typeof path !== 'string' ||
    (severity !== 'error' && severity !== 'warning') ||
    typeof message !== 'string'
  ) {
    throw new TypeError('Demo diagnostic has an invalid shape.');
  }
  return { code, path, severity, message };
}

function readDiagnostics(value: unknown): readonly DemoDiagnostic[] {
  if (!Array.isArray(value)) throw new TypeError('Demo diagnostics must be an array.');
  return value.map((diagnostic) => readDiagnostic(diagnostic));
}

export function readDefinitionResult(value: unknown): DemoDefinitionResult {
  if (!isObject(value) || typeof value['accepted'] !== 'boolean') {
    throw new TypeError('Demo definition response has an invalid shape.');
  }
  const definition = value['definition'];
  if (definition !== undefined && !isObject(definition)) {
    throw new TypeError('Demo definition must be a JSON object.');
  }
  return {
    runtime: readRuntime(value['runtime']),
    accepted: value['accepted'],
    ...(definition === undefined ? {} : { definition: definition as SurveyDefinition }),
    diagnostics: readDiagnostics(value['diagnostics']),
  };
}

function readScore(value: unknown): DemoQuizScore {
  if (!isObject(value)) throw new TypeError('Demo score must be an object.');
  const { earned, possible, questionCount, ratio } = value;
  if (
    typeof earned !== 'number' ||
    typeof possible !== 'number' ||
    typeof questionCount !== 'number' ||
    typeof ratio !== 'number'
  ) {
    throw new TypeError('Demo score has an invalid shape.');
  }
  return { earned, possible, questionCount, ratio };
}

function readSubmissionError(value: unknown): DemoSubmissionError {
  if (!isObject(value)) throw new TypeError('Demo submission error must be an object.');
  const { name, kind, message, path } = value;
  if (
    typeof name !== 'string' ||
    typeof kind !== 'string' ||
    typeof message !== 'string' ||
    typeof path !== 'string'
  ) {
    throw new TypeError('Demo submission error has an invalid shape.');
  }
  return { name, kind, message, path };
}

export function readAnswerValidationResult(value: unknown): readonly DemoSubmissionError[] {
  if (!isObject(value) || !Array.isArray(value['errors'])) {
    throw new TypeError('Demo answer validation response has an invalid shape.');
  }
  readRuntime(value['runtime']);
  return value['errors'].map((error) => readSubmissionError(error));
}

export function readSubmissionResult(value: unknown): DemoSubmissionResult {
  if (
    !isObject(value) ||
    typeof value['accepted'] !== 'boolean' ||
    typeof value['completed'] !== 'boolean' ||
    typeof value['outcome'] !== 'string' ||
    !isObject(value['data']) ||
    !Array.isArray(value['errors'])
  ) {
    throw new TypeError('Demo submission response has an invalid shape.');
  }
  return {
    runtime: readRuntime(value['runtime']),
    accepted: value['accepted'],
    completed: value['completed'],
    outcome: value['outcome'],
    data: value['data'],
    score: readScore(value['score']),
    errors: value['errors'].map(readSubmissionError),
    diagnostics: readDiagnostics(value['diagnostics']),
  };
}
