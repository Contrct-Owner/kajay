import assert from 'node:assert/strict';
import test from 'node:test';
import { checkUnitTestSource } from './unit-test-policy.mjs';

const mutations = [
  ['jsdom', "import { JSDOM } from 'jsdom';", 'jsdom'],
  ['browser runner', "import { page } from '@vitest/browser';", 'browser-runner'],
  ['current browser runner', "import { userEvent } from 'vitest/browser';", 'browser-runner'],
  [
    'deprecated browser context',
    "import { page } from '@vitest/browser/context';",
    'deprecated-browser-context',
  ],
  ['filesystem', "import { readFile } from 'node:fs/promises';", 'filesystem'],
  ['network module', "import { request } from 'node:https';", 'network'],
  ['network global', "await fetch('https://example.test');", 'network'],
  ['network constructor', "const socket = new WebSocket('wss://example.test');", 'network'],
  ['mocking framework', "import proxyquire from 'proxyquire';", 'mocking-framework'],
  ['own package mock', "vi.mock('@kajay/core', () => ({}));", 'own-package-mock'],
  ['real timer', 'setTimeout(resolve, 0);', 'real-timer'],
  ['polling wait with real timers', 'await vi.waitFor(() => value);', 'real-timer'],
];

test('every forbidden mutation reports its file and rule', () => {
  for (const [label, source, rule] of mutations) {
    const violations = checkUnitTestSource(source, `fixture/${label}.test.ts`);
    assert.equal(violations.some((violation) => violation.rule === rule), true, label);
    assert.equal(violations[0]?.file, `fixture/${label}.test.ts`, label);
    assert.equal(violations[0]?.line, 1, label);
  }
});

test('comments, harmless strings, fake timers and ordinary spies remain allowed', () => {
  const source = `
    // setTimeout and import('jsdom') are prose, not behavior.
    const message = "fetch('https://example.test')";
    vi.useFakeTimers();
    await vi.waitFor(() => true);
    vi.spyOn(console, 'log');
  `;
  assert.deepEqual(checkUnitTestSource(source, 'fixture/allowed.test.ts'), []);
});

test('require and dynamic import cannot bypass module rules', () => {
  assert.equal(checkUnitTestSource("require('node:fs')")[0]?.rule, 'filesystem');
  assert.equal(checkUnitTestSource("import('node:http')")[0]?.rule, 'network');
});
