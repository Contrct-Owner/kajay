#!/usr/bin/env node
/**
 * Regenerates `contracts/survey-schema.json` from the metadata registry and fails on
 * drift, so every change to the definition format shows up as a reviewable diff in the
 * PR that causes it.
 *
 * `--write` updates the committed file. A drift you did not expect is a design signal,
 * not noise to regenerate away.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const contractPath = resolve(repoRoot, 'contracts/survey-schema.json');
const corePath = resolve(repoRoot, 'packages/core/dist/index.js');

if (!existsSync(corePath)) {
  console.error('The contract is generated from the built core package, which is missing.');
  console.error('Run `npm run build` first.');
  process.exit(1);
}

const { generateContract } = await import(corePath);
const generated = `${JSON.stringify(generateContract(), null, 2)}\n`;
const shouldWrite = process.argv.includes('--write');

if (shouldWrite) {
  mkdirSync(dirname(contractPath), { recursive: true });
  writeFileSync(contractPath, generated, 'utf8');
  console.log(`Wrote ${contractPath}`);
  process.exit(0);
}

if (!existsSync(contractPath)) {
  console.error(`Contract file is missing: ${contractPath}`);
  console.error('Generate it with `npm run check:contract -- --write` and commit the result.');
  process.exit(1);
}

const committed = readFileSync(contractPath, 'utf8');
if (committed === generated) {
  console.log('Contract is up to date.');
  process.exit(0);
}

console.error('\nContract drift detected: the metadata registry no longer matches the committed schema.\n');

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
console.error('\nReview the change, then commit the regenerated contract in the same PR:');
console.error('  npm run check:contract -- --write\n');
process.exit(1);
