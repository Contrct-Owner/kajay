#!/usr/bin/env node
import { resolve } from 'node:path';
import { validateConformanceV2 } from './lib/conformanceV2Corpus.mjs';

const repositoryRoot = resolve(import.meta.dirname, '..');
const { failures, caseCount } = validateConformanceV2(repositoryRoot);

if (failures.length > 0) {
  throw new Error(`Conformance v2 corpus is invalid:\n${failures.map((failure) => `  - ${failure}`).join('\n')}`);
}

console.log(`Conformance v2 specification is structurally valid: ${caseCount} new cases; adapters pending.`);
