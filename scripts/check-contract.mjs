#!/usr/bin/env node
/**
 * Regenerates the committed language-neutral contracts and fails on drift, so every
 * format, metadata, or diagnostic change appears as a reviewable diff in the PR that
 * causes it.
 *
 * `--write` updates the committed file. A drift you did not expect is a design signal,
 * not noise to regenerate away.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateJsonSchema2020 } from './lib/jsonSchema2020.mjs';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const coreGenerator = resolve(repoRoot, 'packages/core/scripts/generate-contracts.mjs');
let generatedContracts;
try {
  generatedContracts = JSON.parse(
    execFileSync(process.execPath, [coreGenerator], { encoding: 'utf8' }),
  );
} catch {
  console.error('The contract is generated from the built core package, which is missing.');
  console.error('Run `pnpm run build` first.');
  process.exit(1);
}
const shouldWrite = process.argv.includes('--write');
const surveySchema = generatedContracts.schema;

// A positive-only check can go green if the validator is accidentally bypassed. Keep a
// deliberately invalid keyword beside the harness so every run proves the meta-schema
// rejects the mutation at the path a maintainer would need to fix.
const mutationFailures = validateJsonSchema2020({
  $schema: surveySchema.$schema,
  type: 'not-a-json-schema-type',
});
if (!mutationFailures.some((failure) => failure.path === '/type')) {
  console.error('The JSON Schema 2020-12 validator accepted an invalid `type` mutation.');
  process.exit(1);
}

const schemaFailures = validateJsonSchema2020(surveySchema);
if (schemaFailures.length > 0) {
  console.error('\nGenerated survey schema is not valid JSON Schema 2020-12:\n');
  for (const failure of schemaFailures) {
    console.error(`  ${failure.path}: ${failure.reason}`);
  }
  console.error('');
  process.exit(1);
}
console.log('Generated survey schema is valid JSON Schema 2020-12.');

const artifacts = [
  ['contracts/survey-schema.json', surveySchema],
  ['contracts/runtime-metadata.json', generatedContracts.metadata],
  ['contracts/runtime-diagnostics.json', generatedContracts.diagnostics],
];

let drifted = false;

for (const [relativePath, value] of artifacts) {
  const contractPath = resolve(repoRoot, relativePath);
  const generated = `${JSON.stringify(value, null, 2)}\n`;

  if (shouldWrite) {
    mkdirSync(dirname(contractPath), { recursive: true });
    writeFileSync(contractPath, generated, 'utf8');
    console.log(`Wrote ${contractPath}`);
    continue;
  }

  if (!existsSync(contractPath)) {
    console.error(`Contract file is missing: ${contractPath}`);
    drifted = true;
    continue;
  }

  const committed = readFileSync(contractPath, 'utf8');
  if (committed === generated) {
    console.log(`Contract is up to date: ${relativePath}`);
    continue;
  }

  drifted = true;
  console.error(`\nContract drift detected: ${relativePath}\n`);

  const committedLines = committed.split('\n');
  const generatedLines = generated.split('\n');
  const maxLines = Math.max(committedLines.length, generatedLines.length);
  let shown = 0;
  for (let i = 0; i < maxLines && shown < 40; i += 1) {
    if (committedLines[i] !== generatedLines[i]) {
      console.error(`  line ${i + 1}`);
      console.error(`    committed: ${committedLines[i] ?? '(absent)'}`);
      console.error(`    generated: ${generatedLines[i] ?? '(absent)'}`);
      shown += 1;
    }
  }
}

if (shouldWrite) {
  process.exit(0);
}

if (!drifted) {
  console.log('All language-neutral contracts are up to date.');
  process.exit(0);
}

console.error('\nGenerate and review the contracts, then commit them in the same PR:');
console.error('  pnpm run check:contract -- --write\n');
process.exit(1);
