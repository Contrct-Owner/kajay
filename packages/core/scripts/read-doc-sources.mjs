import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Package-owned bridge for documentation generation.
 *
 * Repository scripts may not inspect package implementation paths. This helper lives
 * inside core, where those sources are owned, and exposes only the two authoritative
 * syntax inputs the documentation generator needs.
 */
const packageRoot = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(packageRoot, path), 'utf8');

process.stdout.write(JSON.stringify({
  operatorSource: read('src/expressions/operators.ts'),
  functionSource: read('src/expressions/builtInFunctions.ts'),
}));
