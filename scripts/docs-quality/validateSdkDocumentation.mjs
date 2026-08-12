import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const TYPESCRIPT_PACKAGES = [
  '@kajay/core',
  '@kajay/react',
  '@kajay/creator-core',
  '@kajay/creator-react',
  '@kajay/themes',
];

const README_PATHS = [
  'packages/core/README.md',
  'packages/react/README.md',
  'packages/creator-core/README.md',
  'packages/creator-react/README.md',
  'packages/themes/README.md',
  'dotnet/README.md',
];

/** Verifies that every maintained SDK has an adoption path and public package reference. */
export function validateSdkDocumentation({ pages, manifest, readmeExists }) {
  const errors = [];
  for (const sdk of ['typescript', 'dotnet']) {
    if (!pages.some((page) => page.sdk === sdk)) {
      errors.push(`The authored documentation catalog has no ${sdk} SDK page.`);
    }
  }
  const packages = new Set(manifest.apiSymbols.map(({ packageName }) => packageName));
  for (const packageName of [...TYPESCRIPT_PACKAGES, 'Kajay.Core']) {
    if (!packages.has(packageName)) {
      errors.push(`Generated API reference has no public symbols for ${packageName}.`);
    }
  }
  for (const path of README_PATHS) {
    if (!readmeExists(path)) errors.push(`Published SDK entry point ${path} does not exist.`);
  }
  return errors;
}

export function validateRepositorySdkDocumentation(repositoryRoot, pages, manifest) {
  return validateSdkDocumentation({
    pages,
    manifest,
    readmeExists: (path) => existsSync(resolve(repositoryRoot, path)),
  });
}
