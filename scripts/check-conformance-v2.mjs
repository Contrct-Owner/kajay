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
];

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const corePath = resolve(repoRoot, 'packages/core/dist/index.js');

if (!existsSync(corePath)) {
  console.error('Conformance runs against the built core package. Run `pnpm run build` first.');
  process.exit(1);
}

const expressions = readSuite('conformance/v2/expressions.json');
equal(expressions.contractVersion, 2, 'expressions corpus contractVersion');

const casesById = new Map(expressions.evaluation.map((testCase) => [testCase.id, testCase]));
equal(casesById.size, expressions.evaluation.length, 'v2 expression case IDs must be unique');

const adapter = new CoreConformanceAdapter(await import(corePath));

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

function readSuite(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), 'utf8'));
}
