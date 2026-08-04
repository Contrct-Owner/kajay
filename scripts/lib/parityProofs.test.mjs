import assert from 'node:assert/strict';
import test from 'node:test';
import {
  enabledParityProofs,
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
