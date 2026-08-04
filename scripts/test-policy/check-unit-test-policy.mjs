import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { checkUnitTestSource } from './unit-test-policy.mjs';

async function packageTestFiles(root, category) {
  const packages = path.join(root, 'packages');
  const entries = await readdir(packages, { withFileTypes: true });
  const packageFiles = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    const testDir = path.join(packages, entry.name, 'test', category);
    try {
      const children = await readdir(testDir, { recursive: true, withFileTypes: true });
      return children
        .filter((child) => child.isFile() && /\.tsx?$/u.test(child.name))
        .map((child) => path.join(child.parentPath, child.name));
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
      return [];
    }
  }));
  return packageFiles.flat().toSorted();
}

async function checkFiles(root, files) {
  const violations = await Promise.all(files.map(async (file) => {
    const relative = path.relative(root, file);
    return checkUnitTestSource(await readFile(file, 'utf8'), relative);
  }));
  return violations.flat();
}

export async function checkUnitTestPolicy(root) {
  const [unitFiles, supportFiles, browserFiles] = await Promise.all([
    packageTestFiles(root, 'unit'),
    packageTestFiles(root, 'support'),
    packageTestFiles(root, 'browser'),
  ]);
  const [unitViolations, browserViolations] = await Promise.all([
    checkFiles(root, [...unitFiles, ...supportFiles]),
    checkFiles(root, browserFiles),
  ]);
  return [
    ...unitViolations,
    ...browserViolations.filter((violation) => violation.rule === 'deprecated-browser-context'),
  ];
}

const invoked = process.argv[1] === undefined ? '' : path.resolve(process.argv[1]);
if (invoked === import.meta.filename) {
  const violations = await checkUnitTestPolicy(process.cwd());
  if (violations.length === 0) {
    console.log('Unit-test source policy passed.');
  } else {
    console.error(`Unit-test source policy failed with ${violations.length} violation(s):\n`);
    for (const violation of violations) {
      console.error(`  [${violation.rule}] ${violation.file}:${violation.line}`);
      console.error(`      ${violation.detail}`);
    }
    process.exitCode = 1;
  }
}
