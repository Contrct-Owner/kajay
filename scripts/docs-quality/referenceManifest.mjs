import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function readGeneratedReferenceManifest(repositoryRoot) {
  const path = resolve(
    repositoryRoot,
    'apps/site/src/features/docs-reference/generated/docsReferenceManifest.ts',
  );
  const source = readFileSync(path, 'utf8');
  const prefix = 'export const docsReferenceManifest = ';
  const suffix = ' as const satisfies DocsReferenceManifest;';
  const start = source.indexOf(prefix);
  const end = source.lastIndexOf(suffix);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Generated documentation reference manifest has an unexpected format.');
  }
  return JSON.parse(source.slice(start + prefix.length, end));
}
