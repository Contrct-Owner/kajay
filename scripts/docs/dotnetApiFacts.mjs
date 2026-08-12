import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.cs') ? [path] : [];
  });
}

function summaryBefore(lines, declarationIndex) {
  const comments = [];
  for (let index = declarationIndex - 1; index >= 0; index -= 1) {
    const line = lines[index]?.trim() ?? '';
    if (!line.startsWith('///')) break;
    comments.unshift(line.slice(3).trim());
  }
  const match = comments.join(' ').match(/<summary>(.*?)<\/summary>/u);
  return match?.[1]
    ?.replaceAll(/<[^>]+>/gu, '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .trim() ?? null;
}

function declarationAt(lines, index) {
  const start = lines[index]?.trim() ?? '';
  const ordinary = start.match(/^public\s+(?:(?:abstract|partial|readonly|sealed|static)\s+)*(class|enum|interface|record|struct)\s+(?:(?:class|struct)\s+)?([A-Za-z_][A-Za-z0-9_]*)/u);
  const delegate = start.match(/^public\s+delegate\s+.+?\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/u);
  const name = ordinary?.[2] ?? delegate?.[1];
  if (name === undefined) return;
  const kind = ordinary?.[1] ?? 'delegate';
  const parts = [];
  for (let at = index; at < lines.length; at += 1) {
    const part = lines[at]?.trim() ?? '';
    parts.push(part.replace(/\s*\{\s*$/u, '').replace(/;\s*$/u, ''));
    if (part.includes('{') || part.endsWith(';') || part.endsWith(');')) break;
  }
  return { kind, name, signature: parts.filter(Boolean).join(' ') };
}

function factsFromSource(source) {
  const lines = source.split('\n');
  const namespace = lines.map((line) => line.match(/^namespace\s+([^;]+);/u)?.[1]).find(Boolean);
  if (namespace === undefined) return [];
  return lines.flatMap((_, index) => {
    const declaration = declarationAt(lines, index);
    if (declaration === undefined) return [];
    return [{
      packageName: 'Kajay.Core',
      name: declaration.name,
      fullName: `${namespace}.${declaration.name}`,
      exportKind: 'type',
      classification: namespace === 'Kajay.Extensibility' ? 'extension' : 'consumer',
      description: summaryBefore(lines, index),
      signature: declaration.signature,
      gaps: summaryBefore(lines, index) === null ? ['description'] : [],
    }];
  });
}

export function dotnetApiFacts(sources, baseline) {
  const baselineNames = new Set(baseline.split('\n').map((line) => line.trim()));
  const declarations = new Map();
  for (const fact of sources.flatMap((source) => factsFromSource(source))) {
    const current = declarations.get(fact.fullName);
    if (current === undefined || current.description === null && fact.description !== null) {
      declarations.set(fact.fullName, fact);
    }
  }
  const facts = [...declarations.values()].toSorted((left, right) =>
    left.fullName.localeCompare(right.fullName));
  const names = new Set();
  for (const fact of facts) {
    if (!baselineNames.has(fact.fullName)) {
      throw new Error(`Public C# type ${fact.fullName} is absent from the API analyzer baseline.`);
    }
    if (names.has(fact.name)) {
      throw new Error(`Public C# type name ${fact.name} is ambiguous across namespaces.`);
    }
    names.add(fact.name);
  }
  return facts.map(({ fullName: _fullName, ...fact }) => fact);
}

export function readDotnetApiFacts(repositoryRoot) {
  const sourceDirectory = join(repositoryRoot, 'dotnet/src/Kajay.Core');
  const baseline = [
    readFileSync(join(sourceDirectory, 'PublicAPI.Shipped.txt'), 'utf8'),
    readFileSync(join(sourceDirectory, 'PublicAPI.Unshipped.txt'), 'utf8'),
  ].join('\n');
  return dotnetApiFacts(
    sourceFiles(sourceDirectory).map((path) => readFileSync(path, 'utf8')),
    baseline,
  );
}
