#!/usr/bin/env node
import { deepStrictEqual, equal } from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CoreConformanceAdapter } from './core-conformance-adapter.mjs';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const corePath = resolve(repoRoot, 'packages/core/dist/index.js');

if (!existsSync(corePath)) {
  console.error('Conformance runs against the built core package. Run `pnpm run build` first.');
  process.exit(1);
}

const adapter = new CoreConformanceAdapter(await import(corePath));
const definitions = readSuite('conformance/v1/definitions.json');
const expressions = readSuite('conformance/v1/expressions.json');
const lifecycle = readSuite('conformance/v1/lifecycle.json');

checkVersion(definitions, 'definitions');
checkVersion(expressions, 'expressions');
checkVersion(lifecycle, 'lifecycle');

let checked = 0;

for (const testCase of definitions.cases) {
  const actual = adapter.canonicalizeDefinition(testCase.input);
  deepStrictEqual(actual, {
    canonical: testCase.canonical,
    diagnostics: testCase.diagnostics,
  }, `definition case ${testCase.id}`);
  const fixedPoint = adapter.canonicalizeDefinition(actual.canonical);
  deepStrictEqual(fixedPoint.canonical, actual.canonical, `definition fixed point ${testCase.id}`);
  checked += 1;
}

for (const testCase of expressions.parsing) {
  deepStrictEqual(
    adapter.parseExpression(testCase.source),
    { canonical: testCase.canonical, errorCodes: testCase.errorCodes },
    `expression parse case ${testCase.id}`,
  );
  checked += 1;
}

for (const testCase of expressions.evaluation) {
  deepStrictEqual(
    adapter.evaluateExpression(testCase, expressions.clock),
    { result: testCase.result, errorCodes: testCase.errorCodes },
    `expression evaluation case ${testCase.id}`,
  );
  checked += 1;
}

for (const scenario of lifecycle.scenarios) {
  const actual = adapter.runLifecycleScenario(scenario);
  deepStrictEqual(
    actual,
    {
      initialState: scenario.initialState,
      steps: scenario.actions.map(({ state, events }) => ({ state, events })),
    },
    `lifecycle scenario ${scenario.id}`,
  );
  checked += 1;
}

console.log(`Cross-language conformance passed: ${checked} cases.`);

function readSuite(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), 'utf8'));
}

function checkVersion(suite, name) {
  equal(suite.contractVersion, 1, `${name} corpus contractVersion`);
}
