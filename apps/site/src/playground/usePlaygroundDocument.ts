import type { SurveyDefinition } from '@kajay/core';

/**
 * A survey definition carried in the address bar — the playground's share link.
 *
 * **Base64 of the JSON, not the JSON.** A definition contains braces, quotes and often
 * `{placeholders}`, and while `encodeURIComponent` would survive a round trip, the result
 * is unreadable *and* fragile: every chat client, issue tracker and markdown renderer that
 * auto-links URLs guesses a different end for one containing `%7B`. Base64url has no
 * characters any of them treat as punctuation.
 *
 * Nothing is stored server-side, which is the point of a playground: a link is the whole
 * artefact, it works offline, and there is no state to expire or moderate.
 */
const PARAM = 'd';

export function encodeDefinition(definition: SurveyDefinition): string {
  const json = JSON.stringify(definition);
  // `unescape(encodeURIComponent(…))` is the standard dance for UTF-8 through `btoa`,
  // which only accepts latin1 — a survey titled in Japanese would throw without it.
  const bytes = new TextEncoder().encode(json);
  const binary = String.fromCodePoint(...bytes);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

/**
 * The definition a link carries, or `undefined` when there is none or it is damaged.
 *
 * **A broken link opens the starter survey rather than an error page.** Someone arriving
 * at a truncated URL — and chat clients truncate — wants a playground, not a diagnosis of
 * somebody else's paste. The definition is the only thing lost, and it was never ours.
 */
export function decodeDefinition(encoded: string | undefined): SurveyDefinition | undefined {
  if (encoded === undefined || encoded.length === 0) {
    return undefined;
  }
  try {
    const padded = encoded.replaceAll('-', '+').replaceAll('_', '/');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.codePointAt(0) ?? 0);
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return isDefinition(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Enough of a check to refuse a link that decodes to something else entirely.
 *
 * Deliberately shallow: `parseSurvey` is the real validator and it reports diagnostics
 * rather than throwing, so anything object-shaped is better handed to it than judged here.
 * What this stops is `?d=` carrying a number or a string, where the Creator would have
 * nothing to open at all.
 */
function isDefinition(value: unknown): value is SurveyDefinition {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The share link for a definition, against whatever origin the page is on. */
export function shareLink(definition: SurveyDefinition, origin: string, path: string): string {
  return `${origin}${path}?${PARAM}=${encodeDefinition(definition)}`;
}

export const DEFINITION_PARAM = PARAM;
