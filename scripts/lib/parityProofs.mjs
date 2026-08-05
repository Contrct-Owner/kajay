import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import ts from 'typescript';
import { listSourceFiles } from './workspace.mjs';
import { WORKSPACE_PACKAGE_POLICIES } from './workspacePolicy.mjs';

const PARITY_PROOF = /\bparity\/[A-Za-z0-9-]+\b/gu;
const GREEN_ROW = /^\|\s*([A-Z][0-9]+)\s*\|/u;
const DISABLED_FILE = /(?:^|[/.])(?:skip|todo|disabled)(?:[/.]|$)/u;
const TEST_ROOTS = new Set(['describe', 'it', 'test']);
const DISABLED_CALLS = new Set(['skip', 'skipIf', 'todo']);
const ADAPTER_ONLY_HEADING = '## Adapter-owned acceptance rows';

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

/**
 * Rows listed here are capabilities whose observable contract genuinely belongs to a
 * framework adapter: DOM identity, focus, event translation, composition, or layout.
 * Keeping the rationale in Markdown makes each exception a reviewable architecture
 * decision instead of a magic allow-list in the checker.
 */
export function parseAdapterOnlyRows(markdown) {
  const headingStart = markdown.indexOf(ADAPTER_ONLY_HEADING);
  if (headingStart < 0) {
    return { rows: new Map(), violations: [`Missing "${ADAPTER_ONLY_HEADING}" section.`] };
  }
  const sectionStart = headingStart + ADAPTER_ONLY_HEADING.length;
  const nextHeading = markdown.indexOf('\n## ', sectionStart);
  const section = markdown.slice(sectionStart, nextHeading < 0 ? undefined : nextHeading);
  const rows = new Map();
  const violations = [];

  for (const line of section.split('\n')) {
    const match = /^\|\s*([A-Z][0-9]+)\s*\|\s*(.*?)\s*\|\s*$/u.exec(line);
    if (match === null) {
      continue;
    }
    const [, id, rationale] = match;
    if (rows.has(id)) {
      violations.push(`Adapter-owned row ${id} is listed more than once.`);
    } else if (rationale.length === 0) {
      violations.push(`Adapter-owned row ${id} needs a rationale.`);
    } else {
      rows.set(id, rationale);
    }
  }

  return { rows, violations };
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

function rowIdOf(proof) {
  return /^parity\/([A-Z][0-9]+)-/u.exec(proof)?.[1];
}

function packagePolicyForLocation(location) {
  return WORKSPACE_PACKAGE_POLICIES.find(({ directory }) =>
    location === directory || location.startsWith(`${directory}/`));
}

function proofKinds(enabledProofs) {
  const adapterRows = new Set();
  const frameworkIndependentRows = new Set();

  for (const [proof, locations] of enabledProofs) {
    const rowId = rowIdOf(proof);
    if (rowId === undefined) {
      continue;
    }
    for (const location of locations) {
      const policy = packagePolicyForLocation(location);
      if (policy?.role === 'ui' && /\/test\/browser\//u.test(location)) {
        adapterRows.add(rowId);
      }
      if (
        (policy?.role === 'core' || policy?.role === 'assets') &&
        /\/test\/unit\//u.test(location)
      ) {
        frameworkIndependentRows.add(rowId);
      }
    }
  }

  return { adapterRows, frameworkIndependentRows };
}

/**
 * A green capability demonstrated through a UI adapter also needs a unit proof in a
 * framework-independent package, unless the capability is explicitly adapter-owned.
 *
 * This is an ownership proof, not a source-code oracle: it demonstrates that the
 * capability has an independently executable headless interface. It does not claim
 * that React source contains no duplicated or newly misplaced semantic decision.
 */
export function adapterHeadlessOwnershipViolations(rows, enabledProofs, adapterOnlyRows) {
  const violations = [];
  const greenRows = new Set(rows.map(({ id }) => id));
  const { adapterRows, frameworkIndependentRows } = proofKinds(enabledProofs);

  for (const id of adapterRows) {
    if (
      greenRows.has(id) &&
      !frameworkIndependentRows.has(id) &&
      !adapterOnlyRows.has(id)
    ) {
      violations.push(
        `[${id}] has a React-adapter proof but no framework-independent unit proof. ` +
        'Move its semantics behind a headless interface, or document why the row is adapter-owned.',
      );
    }
  }

  for (const id of adapterOnlyRows.keys()) {
    if (!greenRows.has(id)) {
      violations.push(`[${id}] is an adapter-owned exception but is not a green checklist row.`);
    } else if (!adapterRows.has(id)) {
      violations.push(`[${id}] is an adapter-owned exception but has no React browser proof.`);
    } else if (frameworkIndependentRows.has(id)) {
      violations.push(
        `[${id}] now has a framework-independent unit proof; remove its adapter-owned exception.`,
      );
    }
  }

  return violations;
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
