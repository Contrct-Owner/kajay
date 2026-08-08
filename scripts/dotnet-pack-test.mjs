#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const repositoryRoot = resolve(import.meta.dirname, '..');
const project = resolve(repositoryRoot, 'dotnet/src/Kajay.Core/Kajay.Core.csproj');
const dotnetSmoke = ['dotnet-pack-question-model-smoke.cs', 'dotnet-pack-host-io-smoke.cs', 'dotnet-pack-portability-smoke.cs', 'dotnet-pack-snapshot-smoke.cs'].map((file) => readFileSync(resolve(repositoryRoot, `scripts/${file}`), 'utf8')).join('\n');
const dotnetTypes = readFileSync(resolve(repositoryRoot, 'scripts/dotnet-pack-portability-types.cs'), 'utf8');
const consumerBody = readFileSync(resolve(repositoryRoot, 'scripts/dotnet-pack-consumer.cs'), 'utf8');
const consumerProgram = `${consumerBody}${dotnetSmoke}
Console.WriteLine("dotnet pack smoke: ok");
${dotnetTypes}
`;
const scratch = mkdtempSync(join(tmpdir(), 'kajay-dotnet-pack-'));
const packageDirectory = join(scratch, 'packages');
const consumerDirectory = join(scratch, 'consumer');
try {
  mkdirSync(packageDirectory);
  mkdirSync(consumerDirectory);
  run('dotnet', [
    'pack',
    project,
    '--configuration',
    'Release',
    '--no-restore',
    '--output',
    packageDirectory,
  ]);
  const packageFile = readdirSync(packageDirectory).find(
    (file) => file.startsWith('Kajay.Core.') && file.endsWith('.nupkg'),
  );
  if (packageFile === undefined) throw new Error('Kajay.Core pack produced no .nupkg.');
  const packageVersion = packageFile.slice('Kajay.Core.'.length, -'.nupkg'.length);
  // Compare against what the manifest declares rather than a literal: this catches a pack that
  // produced something other than the csproj asked for, without failing every version bump.
  const declaredVersion = /<Version>([^<]+)<\/Version>/u.exec(readFileSync(project, 'utf8'))?.[1];
  if (packageVersion !== declaredVersion) throw new Error(`Kajay.Core.csproj declares ${declaredVersion}, but pack produced ${packageVersion}.`);
  const consumerProjectPath = join(consumerDirectory, 'Consumer.csproj');
  writeFileSync(consumerProjectPath, consumerProject(packageVersion));
  writeFileSync(join(consumerDirectory, 'Program.cs'), consumerProgram);
  run('dotnet', [
    'restore',
    consumerProjectPath,
    '--source',
    packageDirectory,
    '--ignore-failed-sources',
  ]);
  run('dotnet', [
    'run',
    '--project',
    consumerProjectPath,
    '--configuration',
    'Release',
    '--no-restore',
  ]);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
function run(command, args) {
  execFileSync(command, args, {
    cwd: repositoryRoot,
    env: { ...process.env, NUGET_PACKAGES: join(scratch, 'nuget-packages') },
    stdio: 'inherit',
  });
}

function consumerProject(packageVersion) {
  return `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Kajay.Core" Version="${packageVersion}" />
  </ItemGroup>
</Project>
`;
}
