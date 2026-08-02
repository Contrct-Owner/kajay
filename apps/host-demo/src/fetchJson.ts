import type { ChoiceFetcher } from '@kajay/core';

/**
 * The host's own loader for `choicesByUrl`.
 *
 * It lives here rather than in `@kajay/core` because core is DOM-free with zero
 * runtime dependencies and cannot reference `fetch` at all. That is the seam working
 * as intended: the engine stays backend-agnostic, and an application decides how its
 * requests are made — auth headers, retries, a proxy, a mock in tests.
 */
export const fetchJson: ChoiceFetcher = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${String(response.status)} ${response.statusText}`);
  }
  return response.json();
};
