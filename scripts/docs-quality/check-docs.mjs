import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PUBLIC_RUNTIME_SURFACE } from '../lib/publicRuntimeSurface.mjs';
import { readAuthoredPageRegistry } from './pageRegistrySource.mjs';
import { readGeneratedReferenceManifest } from './referenceManifest.mjs';
import { validatePageRegistry } from './validatePageRegistry.mjs';
import { validatePageCatalog } from './validatePageCatalog.mjs';
import { validateReferenceCoverage } from './validateReferenceCoverage.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../..');

function fail(errors) {
  if (errors.length === 0) return;
  throw new Error(`Documentation quality check failed:\n${errors.map((error) => `  - ${error}`).join('\n')}`);
}

const generation = spawnSync(
  process.execPath,
  [resolve(repositoryRoot, 'scripts/docs/generate-reference-manifest.mjs'), '--check'],
  { cwd: repositoryRoot, encoding: 'utf8' },
);
if (generation.status !== 0) {
  process.stderr.write(generation.stderr);
  throw new Error('Generated documentation reference is stale.');
}
process.stdout.write(generation.stdout);

const pages = readAuthoredPageRegistry(repositoryRoot);
fail(validatePageRegistry(pages));

const metadata = JSON.parse(readFileSync(resolve(repositoryRoot, 'contracts/runtime-metadata.json'), 'utf8'));
const manifest = readGeneratedReferenceManifest(repositoryRoot);
fail(validatePageCatalog(pages, manifest));
fail(validateReferenceCoverage({ manifest, metadata, publicRuntimeSurface: PUBLIC_RUNTIME_SURFACE }));

console.log(`Checked ${pages.length} authored documentation pages and generated reference coverage.`);
