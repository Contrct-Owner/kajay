#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const project = resolve(repositoryRoot, 'dotnet/tools/Kajay.Cli/Kajay.Cli.csproj');
const scratch = mkdtempSync(join(tmpdir(), 'kajay-cli-pack-'));
const packages = join(scratch, 'packages');
const tools = join(scratch, 'tools');

try {
  run('dotnet', [
    'pack',
    project,
    '--configuration',
    'Release',
    '--no-build',
    '--no-restore',
    '--output',
    packages,
  ]);
  run('dotnet', [
    'tool',
    'install',
    'Kajay.Cli',
    '--tool-path',
    tools,
    '--version',
    readVersion(project),
    '--add-source',
    packages,
    '--ignore-failed-sources',
  ]);
  const assembly = findFile(tools, 'Kajay.Cli.dll');
  const help = execFileSync('dotnet', [assembly, 'promote', '--help'], { encoding: 'utf8' });
  if (!help.includes('--source-host') || !help.includes('--target-host')) {
    throw new Error('The installed Kajay CLI did not expose the promotion interface.');
  }
  console.log('The installed Kajay CLI package smoke test passed.');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

function readVersion(path) {
  const projectXml = readFileSync(path, 'utf8');
  const match = projectXml.match(/<Version>([^<]+)<\/Version>/u);
  if (!match) {
    throw new Error('Kajay.Cli.csproj must declare an explicit package version.');
  }
  return match[1];
}

function findFile(directory, name) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = findFile(path, name);
      if (nested) {
        return nested;
      }
    } else if (entry.name === name) {
      return path;
    }
  }
  if (directory === tools) {
    throw new Error(`The installed tool did not contain ${name}.`);
  }
  return null;
}

function run(command, args) {
  execFileSync(command, args, { cwd: repositoryRoot, stdio: 'inherit' });
}
