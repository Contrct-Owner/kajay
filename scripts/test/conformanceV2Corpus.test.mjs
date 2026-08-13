import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { validateConformanceV2 } from '../lib/conformanceV2Corpus.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../..');

test('the specified v2 corpus conforms to its committed schema', () => {
  const result = validateConformanceV2(repositoryRoot);
  assert.deepEqual(result.failures, []);
  assert.equal(result.caseCount, 41);
});
