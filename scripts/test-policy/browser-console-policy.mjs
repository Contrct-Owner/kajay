/** Creates the one-test allow-list used by the browser console guard. */
export function createBrowserConsolePolicy() {
  const expected = [];

  return {
    expect(method, pattern) {
      expected.push({ method, pattern });
    },
    receive(method, values) {
      const message = values.map(String).join(' ');
      const index = expected.findIndex(
        (entry) => entry.method === method && entry.pattern.test(message),
      );
      if (index === -1) {
        throw new Error(`Unexpected browser console.${method}: ${message}`);
      }
      expected.splice(index, 1);
    },
    finish() {
      if (expected.length === 0) {
        return;
      }
      const missing = expected.map((entry) => `console.${entry.method} ${entry.pattern}`).join(', ');
      throw new Error(`Expected browser console output was not observed: ${missing}`);
    },
  };
}
