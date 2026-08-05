import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adapterHeadlessOwnershipViolations,
  enabledParityProofs,
  parseAdapterOnlyRows,
  parseGreenProofRows,
  parityProofViolations,
} from './parityProofs.mjs';

test('green checklist rows retain named tests and verified commands', () => {
  const rows = parseGreenProofRows([
    '| A1 | behavior | ☑ | `parity/A1-behavior` |',
    '| N4 | package artifact | ☑ | `pnpm run test:pack` |',
    '| O1 | watch item | ☐ | none |',
  ].join('\n'));

  assert.deepEqual(rows, [
    { id: 'A1', parityProofs: ['parity/A1-behavior'], commandProofs: [] },
    { id: 'N4', parityProofs: [], commandProofs: ['test:pack'] },
  ]);
});

test('enabled tests inherit proof names from active suites', () => {
  const proofs = enabledParityProofs(`
    describe('parity/A1-active-suite', () => {
      test('observable behavior', () => {});
    });
    test('parity/A2-active-test', () => {});
  `);

  assert.deepEqual([...proofs].toSorted(), ['parity/A1-active-suite', 'parity/A2-active-test']);
});

test('comments, skipped calls, skipped suites, and disabled files do not prove rows', () => {
  const source = `
    // test('parity/A1-commented', () => {});
    test.skip('parity/A2-skipped', () => {});
    describe.skip('parity/A3-skipped-suite', () => test('behavior', () => {}));
    test('parity/A4-active', () => {});
  `;

  assert.deepEqual([...enabledParityProofs(source)], ['parity/A4-active']);
  assert.deepEqual([...enabledParityProofs(source, 'proof.skip.test.ts')], []);
});

test('missing, skipped, and unverified proof references are violations', () => {
  const rows = [
    { id: 'A1', parityProofs: ['parity/A1-present'], commandProofs: [] },
    { id: 'A2', parityProofs: ['parity/A2-missing'], commandProofs: [] },
    { id: 'N4', parityProofs: [], commandProofs: ['test:pack'] },
  ];
  const manifest = { scripts: { 'test:pack': 'node pack.mjs', verify: 'pnpm run test:unit' } };

  assert.deepEqual(parityProofViolations(rows, new Map([['parity/A1-present', []]]), manifest), [
    '[A2] has no enabled test or verified command proof.',
    '[A2] names parity/A2-missing, but no enabled test or suite carries it.',
    '[N4] has no enabled test or verified command proof.',
    '[N4] names pnpm run test:pack, but it is absent from the verify chain.',
  ]);
});

test('adapter-owned rows are reviewable decisions with rationales', () => {
  const parsed = parseAdapterOnlyRows(`
# Contract

## Adapter-owned acceptance rows

| Row | Adapter-owned responsibility |
| --- | --- |
| A4 | React component dispatch. |
| A4 | Duplicate. |
| P2 |  |
`);

  assert.deepEqual([...parsed.rows], [['A4', 'React component dispatch.']]);
  assert.deepEqual(parsed.violations, [
    'Adapter-owned row A4 is listed more than once.',
    'Adapter-owned row P2 needs a rationale.',
  ]);
});

test('React acceptance requires a framework-independent proof or a reviewed exception', () => {
  const rows = [
    { id: 'A1', parityProofs: [], commandProofs: [] },
    { id: 'A2', parityProofs: [], commandProofs: [] },
    { id: 'A3', parityProofs: [], commandProofs: [] },
  ];
  const proofs = new Map([
    ['parity/A1-behavior', [
      'packages/react/test/browser/a.test.tsx',
      'packages/core/test/unit/a.test.ts',
    ]],
    ['parity/A2-layout', ['packages/react/test/browser/b.test.tsx']],
    ['parity/A3-model', [
      'packages/creator-react/test/browser/c.test.tsx',
      'packages/creator-core/test/unit/c.test.ts',
    ]],
  ]);

  assert.deepEqual(adapterHeadlessOwnershipViolations(rows, proofs, new Map()), [
    '[A2] has a React-adapter proof but no framework-independent unit proof. ' +
      'Move its semantics behind a headless interface, or document why the row is adapter-owned.',
  ]);
  assert.deepEqual(
    adapterHeadlessOwnershipViolations(rows, proofs, new Map([['A2', 'DOM layout.']])),
    [],
  );
});

test('adapter-owned exceptions fail when stale or superseded by a headless proof', () => {
  const rows = [
    { id: 'A1', parityProofs: [], commandProofs: [] },
    { id: 'A2', parityProofs: [], commandProofs: [] },
  ];
  const proofs = new Map([
    ['parity/A1-behavior', [
      'packages/react/test/browser/a.test.tsx',
      'packages/core/test/unit/a.test.ts',
    ]],
  ]);
  const exceptions = new Map([
    ['A1', 'No longer true.'],
    ['A2', 'No adapter proof.'],
    ['A3', 'No green row.'],
  ]);

  assert.deepEqual(adapterHeadlessOwnershipViolations(rows, proofs, exceptions), [
    '[A1] now has a framework-independent unit proof; remove its adapter-owned exception.',
    '[A2] is an adapter-owned exception but has no React browser proof.',
    '[A3] is an adapter-owned exception but is not a green checklist row.',
  ]);
});
