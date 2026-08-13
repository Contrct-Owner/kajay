#!/usr/bin/env node
import { deepStrictEqual, equal } from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CoreConformanceAdapter } from './core-conformance-adapter.mjs';

const implementedExpressionIds = [
  'decimal-text-with-exponent-is-numeric',
  'leading-decimal-point-is-numeric',
  'contract-whitespace-is-trimmed-from-numeric-text',
  'hexadecimal-text-is-not-numeric',
  'boolean-is-not-numeric',
  'boolean-arithmetic-is-absent',
  'non-finite-arithmetic-is-absent',
  'boolean-text-is-not-a-boolean',
  'empty-array-is-false',
  'empty-object-is-true',
  'numeric-zero-is-false',
  'non-empty-numeric-text-is-true',
  'boolean-text-conversion-is-invariant',
  'objects-compare-structurally',
  'different-objects-are-not-equal',
  'objects-do-not-concatenate-through-host-text',
  'text-order-is-ordinal-utf16',
  'round-positive-midpoint-away-from-zero',
  'round-negative-midpoint-away-from-zero',
  'date-only-is-midnight-utc',
  'offset-date-time-normalizes-to-utc',
  'fractional-date-time-normalizes-to-milliseconds',
  'local-date-time-is-invalid',
  'rollover-date-is-invalid',
  'sub-millisecond-date-time-is-invalid',
];

const implementedDefinitionIds = [
  'a-fill-in-the-blank-template-round-trips-with-its-markers',
  'a-translation-may-move-a-blank-but-not-rename-one',
  'element-named-into-the-host-scope-is-reported-and-kept',
  'unsupported-pattern-is-preserved-and-reported',
  'malformed-pattern-is-preserved-and-reported',
];
const implementedScenarioIds = [
  'host-values-resolve-including-descent-into-structured-values',
  'a-host-value-write-recomputes-without-being-an-answer-change',
  'the-host-scope-and-the-answer-scope-are-independent',
  'portable-pattern-matches-and-rejects',
  'pattern-searches-unless-anchored',
  'pattern-classes-and-dot-use-defined-scalars',
  'invalid-pattern-is-an-author-error-not-a-respondent-rule',
  'a-multi-select-is-scored-choice-by-choice',
  'survey-scenario-observes-quiz-score',
];

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const corePath = resolve(repoRoot, 'packages/core/dist/index.js');

if (!existsSync(corePath)) {
  console.error('Conformance runs against the built core package. Run `pnpm run build` first.');
  process.exit(1);
}

const expressions = readSuite('conformance/v2/expressions.json');
equal(expressions.contractVersion, 2, 'expressions corpus contractVersion');
const definitions = readSuite('conformance/v2/definitions.json');
equal(definitions.contractVersion, 2, 'definitions corpus contractVersion');
const scenarios = readSuite('conformance/v2/scenarios.json');
equal(scenarios.contractVersion, 2, 'scenarios corpus contractVersion');

const casesById = new Map(expressions.evaluation.map((testCase) => [testCase.id, testCase]));
equal(casesById.size, expressions.evaluation.length, 'v2 expression case IDs must be unique');

const adapter = new CoreConformanceAdapter(await import(corePath));

const definitionsById = new Map(definitions.cases.map((testCase) => [testCase.id, testCase]));
for (const caseId of implementedDefinitionIds) {
  const testCase = definitionsById.get(caseId);
  if (testCase === undefined) {
    throw new Error(`Implemented v2 definition case is missing from the corpus: ${caseId}`);
  }
  deepStrictEqual(
    adapter.canonicalizeDefinition(testCase.input),
    { canonical: testCase.canonical, diagnostics: testCase.diagnostics },
    `v2 definition case ${testCase.id}`,
  );
}

const scenariosById = new Map(scenarios.scenarios.map((scenario) => [scenario.id, scenario]));
for (const scenarioId of implementedScenarioIds) {
  const scenario = scenariosById.get(scenarioId);
  if (scenario === undefined) {
    throw new Error(`Implemented v2 survey scenario is missing from the corpus: ${scenarioId}`);
  }
  deepStrictEqual(
    adapter.runSurveyScenario(scenario),
    {
      initial: scenario.expectInitial,
      steps: scenario.steps.map(({ expect }) => expect),
    },
    `v2 survey scenario ${scenario.id}`,
  );
}

for (const caseId of implementedExpressionIds) {
  const testCase = casesById.get(caseId);
  if (testCase === undefined) {
    throw new Error(`Implemented v2 expression case is missing from the corpus: ${caseId}`);
  }

  deepStrictEqual(
    adapter.evaluateExpression(testCase, expressions.clock),
    { result: testCase.result, errorCodes: testCase.errorCodes },
    `v2 expression evaluation case ${testCase.id}`,
  );
}

console.log(
  `TypeScript conformance v2 progress: ${implementedExpressionIds.length}/${expressions.evaluation.length} expression cases.`,
);
console.log(
  `TypeScript conformance v2 progress: ${implementedDefinitionIds.length}/${definitions.cases.length} definition cases.`,
);
console.log(
  `TypeScript conformance v2 progress: ${implementedScenarioIds.length}/${scenarios.scenarios.length} survey scenarios.`,
);

function readSuite(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), 'utf8'));
}
