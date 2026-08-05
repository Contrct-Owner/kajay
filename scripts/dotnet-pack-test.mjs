#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const project = resolve(repositoryRoot, 'dotnet/src/Kajay.Core/Kajay.Core.csproj');
const consumerProgram = `using System;
using System.IO;
using System.Text.Json;
using Kajay;

using Stream stream = KajayContracts.OpenSurveySchema();
using JsonDocument schema = JsonDocument.Parse(stream);
if (schema.RootElement.GetProperty("$id").GetString() != "urn:kajay:survey-definition:1")
{
    throw new InvalidOperationException("Installed package exposed the wrong survey contract.");
}

const string definition = """{"pages":[{"name":"p1","elements":[{"type":"text","name":"q1"}]}]}""";
const string expected = """{"schemaVersion":1,"pages":[{"name":"p1","elements":[{"type":"text","name":"q1"}]}]}""";
SurveyDefinitionParseResult parsed = SurveyDefinition.Parse(definition);
if (parsed.Diagnostics.Count != 0 || parsed.Definition.ToCanonicalJson() != expected)
{
    throw new InvalidOperationException("Installed package failed definition canonicalization.");
}

ExpressionParseResult expression = SurveyExpression.Parse("{a} = 1 && {b} <> 2");
if (expression.Errors.Count != 0
    || expression.Expression?.ToCanonicalString() != "{a} == 1 and {b} != 2")
{
    throw new InvalidOperationException("Installed package failed expression canonicalization.");
}

Console.WriteLine("dotnet pack smoke: ok");
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
