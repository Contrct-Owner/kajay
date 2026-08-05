#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  adapterHeadlessOwnershipViolations,
  parseAdapterOnlyRows,
  parseGreenProofRows,
  parityProofViolations,
  repositoryParityProofs,
} from './lib/parityProofs.mjs';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const checklist = readFileSync(resolve(repoRoot, 'docs/feature-parity-checklist.md'), 'utf8');
const adapterContract = readFileSync(resolve(repoRoot, 'docs/headless-adapter-contract.md'), 'utf8');
const manifest = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'));
const rows = parseGreenProofRows(checklist);
const proofs = repositoryParityProofs(repoRoot);
const adapterOnly = parseAdapterOnlyRows(adapterContract);
const violations = [
  ...adapterOnly.violations,
  ...parityProofViolations(rows, proofs, manifest),
  ...adapterHeadlessOwnershipViolations(rows, proofs, adapterOnly.rows),
];

if (violations.length > 0) {
  console.error(`\nParity-proof check failed with ${violations.length} violation(s):\n`);
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  console.error('');
  process.exit(1);
}

console.log(`Parity proofs resolve for ${rows.length} green checklist rows (${proofs.size} enabled names).`);
