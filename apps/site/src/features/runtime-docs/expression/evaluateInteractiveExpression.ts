import {
  createDefaultFunctionRegistry,
  createValueResolver,
  evaluateExpression,
  parseExpression,
  printExpression,
} from '@kajay/core';

export interface EvaluatorSuccess {
  readonly kind: 'success';
  readonly canonical: string;
  readonly value: string;
}

export interface EvaluatorFailure {
  readonly kind: 'failure';
  readonly errors: readonly string[];
}

export type EvaluatorOutcome = EvaluatorSuccess | EvaluatorFailure;

interface ParsedData {
  readonly kind: 'data';
  readonly value: Readonly<Record<string, unknown>>;
}

const REFERENCE_CLOCK = new Date('2026-08-02T12:34:56.000Z');

function readData(source: string): ParsedData | EvaluatorFailure {
  try {
    const value: unknown = JSON.parse(source);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { kind: 'failure', errors: ['Values must be a JSON object.'] };
    }
    return { kind: 'data', value: value as Readonly<Record<string, unknown>> };
  } catch (cause) {
    return {
      kind: 'failure',
      errors: [cause instanceof Error ? `Values are not valid JSON: ${cause.message}` : 'Values are not valid JSON.'],
    };
  }
}

function displayValue(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return JSON.stringify(value);
}

export function evaluateInteractiveExpression(expression: string, dataSource: string): EvaluatorOutcome {
  const data = readData(dataSource);
  if (data.kind === 'failure') {
    return data;
  }

  const parsed = parseExpression(expression);
  if (parsed.errors.length > 0) {
    return {
      kind: 'failure',
      errors: parsed.errors.map(({ code, message }) => `${code}: ${message}`),
    };
  }

  const evaluated = evaluateExpression(parsed.node, {
    getValue: createValueResolver(data.value),
    functions: createDefaultFunctionRegistry(),
    now: REFERENCE_CLOCK,
  });
  if (evaluated.errors.length > 0) {
    return {
      kind: 'failure',
      errors: evaluated.errors.map(({ code, message }) => `${code}: ${message}`),
    };
  }
  return {
    kind: 'success',
    canonical: printExpression(parsed.node),
    value: displayValue(evaluated.value),
  };
}
