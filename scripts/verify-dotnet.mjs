#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const solution = resolve(repositoryRoot, 'dotnet/Kajay.slnx');

run(process.execPath, [resolve(repositoryRoot, 'scripts/check-dotnet-structure.mjs')]);
// No `--locked-mode`: the solution no longer keeps lock files. `IsTrimmable` makes the
// SDK inject `Microsoft.NET.ILLink.Tasks`, and every platform's SDK bundles its own build
// of it, so a content hash is true on exactly one image — see ADR-0030's amendment.
// Transitive versions stay pinned by `CentralPackageTransitivePinningEnabled`.
run('dotnet', ['restore', solution]);
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

function run(command, args) {
  execFileSync(command, args, { cwd: repositoryRoot, stdio: 'inherit' });
}
