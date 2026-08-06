#!/usr/bin/env node
import { deepStrictEqual, equal } from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const corePath = resolve(repoRoot, 'packages/core/dist/index.js');
if (!existsSync(corePath)) {
  throw new Error('Response Snapshot conformance requires a built @kajay/core package.');
}

const core = await import(corePath);
const corpus = JSON.parse(readFileSync(
  resolve(repoRoot, 'conformance/response-snapshot/v1/cases.json'),
  'utf8',
));
const schema = JSON.parse(readFileSync(
  resolve(repoRoot, 'conformance/response-snapshot/v1/snapshot.schema.json'),
  'utf8',
));
const validateSnapshot = new Ajv2020({ strict: true }).compile(schema);
equal(corpus.formatVersion, 1, 'Response Snapshot corpus version');

for (const testCase of corpus.cases) {
  if (!validateSnapshot(testCase.expected)) {
    throw new Error(`Response Snapshot case ${testCase.id} violates its schema: ${JSON.stringify(validateSnapshot.errors)}`);
  }
  const options = testCase.clock === undefined
    ? {}
    : { now: () => new Date(testCase.clock) };
  const survey = core.parseSurvey(testCase.definition, options).survey;
  for (const [name, value] of Object.entries(testCase.answers)) {
    survey.setValue(name, decode(value));
  }
  if (testCase.pageName.length > 0) survey.goTo(testCase.pageName);
  survey.setLocale(testCase.locale);
  if (testCase.lifecycle === 'preview') survey.status.enterPreview();
  if (testCase.lifecycle === 'completed') survey.complete();
  if (testCase.startTimer === true) survey.timer.start();
  const stored = JSON.parse(JSON.stringify(survey.createSnapshot()));
  deepStrictEqual(stored, testCase.expected, `Response Snapshot case ${testCase.id}`);
}

console.log(`TypeScript Response Snapshot Format v1: ${corpus.cases.length} case(s) passed.`);

function decode(tagged) {
  if (tagged.kind === 'absent') return;
  if (tagged.kind === 'json') return tagged.value;
  if (tagged.kind === 'instant') return new Date(tagged.value);
  if (tagged.kind === 'array') return tagged.value.map(decode);
  if (tagged.kind === 'object') {
    return Object.fromEntries(Object.entries(tagged.value).map(([name, value]) => [name, decode(value)]));
  }
  throw new Error(`Unknown Response Snapshot value kind ${String(tagged.kind)}.`);
}
