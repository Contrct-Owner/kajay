import type { ChoiceFetcher } from '@kajay/core';

/**
 * Origins the playground will load choices from — and the complete list of them.
 *
 * **An allowlist because the playground is public and its definitions are shareable.**
 * `choicesByUrl` is a URL in a document, and a link carries the whole document, so without
 * this anybody could hand somebody else a link that makes *their* browser fetch a URL of
 * the sender's choosing. That is worth stopping for its own sake, and doubly so because a
 * visitor's browser reaches places our server cannot: their intranet, their router, and
 * anything they happen to be signed into.
 *
 * The library takes no view on this, correctly — `fetchJson` is a seam precisely so the
 * host decides what may be reached. This is the site exercising that decision; a consumer
 * embedding the Creator behind their own login would reasonably decide otherwise.
 *
 * Public demo APIs with no credentials and no side effects. Adding one is a deliberate act.
 */
const ALLOWED_ORIGINS: readonly string[] = [
  'https://api.restful-api.dev',
  'https://jsonplaceholder.typicode.com',
  'https://restcountries.com',
];

/** What a reader is told when they point the playground somewhere it will not go. */
export function blockedMessage(url: string): string {
  return `The playground only loads choices from ${ALLOWED_ORIGINS.join(', ')}. ${JSON.stringify(url)} is not one of them — run the Creator in your own application to use your own endpoints.`;
}

/**
 * The target, if the allowlist permits it.
 *
 * Compared by **origin**, parsed rather than matched as text. A prefix test would accept
 * `https://api.restful-api.dev.example.com`, which is a different host that merely starts
 * the same way — the classic way an allowlist becomes decorative.
 */
function allowedTarget(url: string): URL {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    throw new Error(`${JSON.stringify(url)} is not a URL the playground can load.`);
  }
  // Scheme included in the origin comparison, so `http://` cannot pass as its `https://`
  // twin and downgrade the request to something a network can read and rewrite.
  if (!ALLOWED_ORIGINS.includes(target.origin)) {
    throw new Error(blockedMessage(url));
  }
  return target;
}

/**
 * The playground's `fetchJson` — checklist B10's seam, with the site's policy in it.
 *
 * `redirect: 'error'` is the part that is easy to leave out and load-bearing: an allowed
 * origin answering `302` to somewhere else would otherwise walk the request straight out
 * of the allowlist, and the check above would have inspected only the first hop.
 *
 * `credentials: 'omit'` because none of these endpoints want a cookie and none of them
 * should receive one, least of all a cookie for a *different* site the browser is holding.
 */
export const fetchPlaygroundChoices: ChoiceFetcher = async (url) => {
  const target = allowedTarget(url);
  const response = await fetch(target, {
    credentials: 'omit',
    redirect: 'error',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`${target.origin} answered ${String(response.status)}.`);
  }
  return response.json();
};
