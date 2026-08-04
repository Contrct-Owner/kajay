import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkUnitTestPolicy } from './check-unit-test-policy.mjs';

test('support modules executed by unit tests are checked', async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), 'kajay-unit-policy-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const unit = path.join(root, 'packages', 'core', 'test', 'unit');
  const support = path.join(root, 'packages', 'core', 'test', 'support');
  await Promise.all([
    mkdir(unit, { recursive: true }),
    mkdir(support, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(path.join(unit, 'example.test.ts'), "import '../support/clock.js';\n", 'utf8'),
    writeFile(path.join(support, 'clock.ts'), 'setTimeout(resolve, 0);\n', 'utf8'),
  ]);

  assert.deepEqual(await checkUnitTestPolicy(root), [
    {
      file: 'packages/core/test/support/clock.ts',
      line: 1,
      rule: 'real-timer',
      detail: 'Use fake timers or an observable promise instead of setTimeout().',
    },
  ]);
});
