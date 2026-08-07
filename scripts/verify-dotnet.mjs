#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const solution = resolve(repositoryRoot, 'dotnet/Kajay.slnx');

run(process.execPath, [resolve(repositoryRoot, 'scripts/check-dotnet-structure.mjs')]);
run('dotnet', ['restore', solution, '--locked-mode']);
run('dotnet', ['format', solution, '--verify-no-changes', '--no-restore']);
run('dotnet', ['build', solution, '--configuration', 'Release', '--no-restore']);
run('dotnet', [
  'test',
  solution,
  '--configuration',
  'Release',
  '--no-build',
  '--no-restore',
]);
run('dotnet', [
  'run',
  '--project',
  resolve(repositoryRoot, 'dotnet/samples/Kajay.Core.GettingStarted'),
  '--configuration',
  'Release',
  '--no-build',
  '--no-restore',
]);
run(process.execPath, [resolve(repositoryRoot, 'scripts/dotnet-pack-test.mjs')]);
run(process.execPath, [resolve(repositoryRoot, 'scripts/dotnet-cli-pack-test.mjs')]);

function run(command, args) {
  execFileSync(command, args, { cwd: repositoryRoot, stdio: 'inherit' });
}
