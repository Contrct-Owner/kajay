import assert from 'node:assert/strict';
import test from 'node:test';
import { createBrowserConsolePolicy } from './browser-console-policy.mjs';

test('unexpected browser warnings and errors fail', () => {
  const policy = createBrowserConsolePolicy();
  assert.throws(() => policy.receive('warn', ['deprecated tool']), /Unexpected browser console.warn/u);
  assert.throws(() => policy.receive('error', ['render failed']), /Unexpected browser console.error/u);
});

test('one local expectation consumes one matching console call', () => {
  const policy = createBrowserConsolePolicy();
  policy.expect('warn', /expected warning/u);
  policy.receive('warn', ['the expected warning']);
  assert.doesNotThrow(() => policy.finish());
  assert.throws(() => policy.receive('warn', ['the expected warning']), /Unexpected/u);
});

test('an unobserved console expectation fails at test completion', () => {
  const policy = createBrowserConsolePolicy();
  policy.expect('error', /expected failure/u);
  assert.throws(() => policy.finish(), /was not observed/u);
});
