import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import ts from 'typescript';
import { listSourceFiles } from './workspace.mjs';

const PARITY_PROOF = /\bparity\/[A-Za-z0-9-]+\b/gu;
const GREEN_ROW = /^\|\s*([A-Z][0-9]+)\s*\|/u;
const DISABLED_FILE = /(?:^|[/.])(?:skip|todo|disabled)(?:[/.]|$)/u;
const TEST_ROOTS = new Set(['describe', 'it', 'test']);
const DISABLED_CALLS = new Set(['skip', 'skipIf', 'todo']);

function uniqueMatches(source, pattern) {
  return [...new Set(source.match(pattern) ?? [])];
}

function greenProofRow(line) {
  const row = line.match(GREEN_ROW);
  const status = line.indexOf('| ☑ |');
  if (row === null || status < 0) {
    return;
  }
  const proofCell = line.slice(status + '| ☑ |'.length).replace(/\|\s*$/u, '').trim();
  return {
    id: row[1],
    parityProofs: uniqueMatches(proofCell, PARITY_PROOF),
    commandProofs: [...proofCell.matchAll(/`pnpm run ([A-Za-z0-9:-]+)`/gu)].map(
      (match) => match[1],
    ),
  };
}

export function parseGreenProofRows(markdown) {
  return markdown
    .split('\n')
    .map((line) => greenProofRow(line))
    .filter((row) => row !== undefined);
}

function callParts(expression) {
  if (ts.isIdentifier(expression)) {
    return [expression.text];
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return [...callParts(expression.expression), expression.name.text];
  }
  if (ts.isCallExpression(expression)) {
    return callParts(expression.expression);
  }
  return [];
}

function literalText(argument) {
  if (argument !== undefined && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))) {
    return argument.text;
  }
}

function callableTest(node) {
  if (!ts.isCallExpression(node)) {
    return;
  }
  const parts = callParts(node.expression);
  if (!TEST_ROOTS.has(parts[0])) {
    return;
  }
  return {
    kind: parts[0],
    disabled: parts.some((part) => DISABLED_CALLS.has(part)),
    title: literalText(node.arguments[0]),
    callback: node.arguments.find(
      (argument) => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument),
    ),
  };
}

function collectFromAst(sourceFile) {
  const proofs = new Set();

  function visit(node, suiteProofs, disabled) {
    const call = callableTest(node);
    if (call?.kind === 'describe') {
      const nextDisabled = disabled || call.disabled;
      const nextProofs = [...suiteProofs, ...uniqueMatches(call.title ?? '', PARITY_PROOF)];
      if (call.callback !== undefined) {
        visit(call.callback.body, nextProofs, nextDisabled);
      }
      return;
    }
    if (call?.kind === 'test' || call?.kind === 'it') {
      if (!disabled && !call.disabled) {
        for (const proof of [...suiteProofs, ...uniqueMatches(call.title ?? '', PARITY_PROOF)]) {
          proofs.add(proof);
        }
      }
      return;
    }
    ts.forEachChild(node, (child) => visit(child, suiteProofs, disabled));
  }

  visit(sourceFile, [], false);
  return proofs;
}

export function enabledParityProofs(source, fileName = 'proof.test.ts') {
  if (DISABLED_FILE.test(fileName)) {
    return new Set();
  }
  const kind = fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  return collectFromAst(sourceFile);
}

function isProofTestFile(path) {
  return (
    /\/test\/(?:unit|browser)\/.*\.test\.tsx?$/u.test(path) ||
    /\/e2e\/.*\.spec\.tsx?$/u.test(path)
  );
}

export function repositoryParityProofs(repoRoot) {
  const proofs = new Map();
  const sourceFiles = [
    ...listSourceFiles(`${repoRoot}/packages`),
    ...listSourceFiles(`${repoRoot}/apps`),
  ].filter((path) => isProofTestFile(path));

  for (const path of sourceFiles) {
    const location = relative(repoRoot, path);
    for (const proof of enabledParityProofs(readFileSync(path, 'utf8'), location)) {
      const locations = proofs.get(proof) ?? [];
      locations.push(location);
      proofs.set(proof, locations);
    }
  }
  return proofs;
}

function commandIsVerified(command, manifest) {
  const script = manifest.scripts?.[command];
  const verification = manifest.scripts?.verify ?? '';
  return typeof script === 'string' && verification.includes(`pnpm run ${command}`);
}

export function parityProofViolations(rows, enabledProofs, manifest) {
  const violations = [];
  for (const row of rows) {
    const missing = row.parityProofs.filter((proof) => !enabledProofs.has(proof));
    const badCommands = row.commandProofs.filter((command) => !commandIsVerified(command, manifest));
    const resolved = row.parityProofs.length - missing.length + row.commandProofs.length - badCommands.length;
    if (resolved === 0) {
      violations.push(`[${row.id}] has no enabled test or verified command proof.`);
    }
    for (const proof of missing) {
      violations.push(`[${row.id}] names ${proof}, but no enabled test or suite carries it.`);
    }
    for (const command of badCommands) {
      violations.push(`[${row.id}] names pnpm run ${command}, but it is absent from the verify chain.`);
    }
  }
  return violations;
}
