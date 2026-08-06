import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const PARITY_PROOF = /\bparity\/[A-Za-z0-9-]+\b/gu;
const DISABLED_FILE = /(?:^|[/.])(?:skip|todo|disabled)(?:[/.]|$)/u;

/** Discovers enabled xUnit proof display names without treating comments as tests. */
export function enabledCSharpParityProofs(source, fileName = 'ProofTests.cs') {
  if (DISABLED_FILE.test(fileName)) {
    return new Set();
  }
  const withoutComments = stripComments(source);
  const proofs = new Set();
  const attribute = /\[(?:[\w.]+\.)?(?:Fact|Theory)(?:Attribute)?\s*(?:\(([\s\S]*?)\))?\]/gu;
  for (const match of withoutComments.matchAll(attribute)) {
    const argumentsText = match[1] ?? '';
    if (/\bSkip\s*=/u.test(argumentsText)) {
      continue;
    }
    const displayName = /\bDisplayName\s*=\s*"([^"]*)"/u.exec(argumentsText)?.[1];
    for (const proof of new Set(displayName?.match(PARITY_PROOF) ?? [])) {
      proofs.add(proof);
    }
  }
  return proofs;
}

export function csharpRepositoryParityProofs(repoRoot) {
  const proofs = new Map();
  for (const path of listTestFiles(`${repoRoot}/dotnet/tests`)) {
    const location = relative(repoRoot, path);
    for (const proof of enabledCSharpParityProofs(readFileSync(path, 'utf8'), location)) {
      const locations = proofs.get(proof) ?? [];
      locations.push(location);
      proofs.set(proof, locations);
    }
  }
  return proofs;
}

function listTestFiles(dir) {
  const files = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'bin' && entry.name !== 'obj' && entry.name !== 'artifacts') {
          walk(full);
        }
      } else if (entry.name.endsWith('Tests.cs')) {
        files.push(full);
      }
    }
  };
  walk(dir);
  return files;
}

function stripComments(source) {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//gu, '')
    .replaceAll(/\/\/[^\n]*/gu, '');
}
