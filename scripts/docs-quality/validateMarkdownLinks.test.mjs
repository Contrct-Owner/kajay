import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateMarkdownLinks } from './validateMarkdownLinks.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'kajay-doc-links-'));
  mkdirSync(join(root, 'docs'));
  writeFileSync(join(root, 'target.md'), '# Target\n');
  return root;
}

test('accepts existing, anchored, web, and fenced-code links', () => {
  const root = fixture();
  writeFileSync(join(root, 'docs', 'source.md'), [
    '[target](../target.md#heading)',
    '[section](#local)',
    '[site](https://kajay.io)',
    '```text',
    '[grammar](not-a-file)',
    '```',
  ].join('\n'));
  assert.deepEqual(validateMarkdownLinks(root), []);
});

test('reports broken local links with their source', () => {
  const root = fixture();
  writeFileSync(join(root, 'docs', 'source.md'), '[missing](../gone.md)\n');
  assert.deepEqual(validateMarkdownLinks(root), [
    'docs/source.md: local link "../gone.md" does not exist.',
  ]);
});
