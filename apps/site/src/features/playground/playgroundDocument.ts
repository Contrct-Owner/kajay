import type { SurveyDefinition } from '@kajay/core';

/**
 * Encode a survey definition for the address bar using URL-safe base64.
 *
 * The link is the whole artifact: nothing is stored server-side, so it works offline and
 * there is no state to expire. UTF-8 bytes preserve definitions written in any script.
 */
export function encodeDefinition(definition: SurveyDefinition): string {
  const json = JSON.stringify(definition);
  const bytes = new TextEncoder().encode(json);
  const binary = String.fromCodePoint(...bytes);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

/**
 * Decode the definition carried by a share link.
 *
 * Damaged or non-object payloads return undefined so the feature opens its starter survey.
 * The check stays shallow because parseSurvey is the authoritative validator and can
 * report useful diagnostics for object-shaped definitions.
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

function isDefinition(value: unknown): value is SurveyDefinition {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Build a share link against the current host origin or a preview deployment. */
export function shareLink(definition: SurveyDefinition, origin: string, path: string): string {
  return `${origin}${path}?d=${encodeDefinition(definition)}`;
}
