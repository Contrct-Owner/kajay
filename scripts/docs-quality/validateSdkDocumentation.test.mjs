import assert from 'node:assert/strict';
import test from 'node:test';
import { validateSdkDocumentation } from './validateSdkDocumentation.mjs';

const packages = [
  '@kajay/core',
  '@kajay/react',
  '@kajay/creator-core',
  '@kajay/creator-react',
  '@kajay/themes',
  'Kajay.Core',
];

test('accepts both SDK guide paths, package APIs, and entry-point READMEs', () => {
  const errors = validateSdkDocumentation({
    pages: [{ sdk: 'typescript' }, { sdk: 'dotnet' }],
    manifest: { apiSymbols: packages.map((packageName) => ({ packageName })) },
    readmeExists: () => true,
  });
  assert.deepEqual(errors, []);
});

test('reports each missing SDK documentation layer', () => {
  const errors = validateSdkDocumentation({
    pages: [{ sdk: 'typescript' }],
    manifest: { apiSymbols: packages.slice(0, -1).map((packageName) => ({ packageName })) },
    readmeExists: (path) => path !== 'packages/core/README.md',
  });
  assert.ok(errors.some((error) => error.includes('no dotnet SDK page')));
  assert.ok(errors.some((error) => error.includes('no public symbols for Kajay.Core')));
  assert.ok(errors.some((error) => error.includes('packages/core/README.md')));
});
