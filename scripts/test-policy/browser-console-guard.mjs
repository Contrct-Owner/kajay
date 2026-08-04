import { afterEach, beforeEach } from 'vitest';
import { createBrowserConsolePolicy } from './browser-console-policy.mjs';

let policy = createBrowserConsolePolicy();

/** Allows exactly one matching console call in the current browser test. */
export function expectBrowserConsole(method, pattern) {
  policy.expect(method, pattern);
}

console.error = (...values) => policy.receive('error', values);
console.warn = (...values) => policy.receive('warn', values);

beforeEach(() => {
  policy = createBrowserConsolePolicy();
});

afterEach(() => {
  policy.finish();
});
