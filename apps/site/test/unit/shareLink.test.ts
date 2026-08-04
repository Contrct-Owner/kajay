import type { SurveyDefinition } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import {
  decodeDefinition,
  encodeDefinition,
  shareLink,
} from '../../src/playground/usePlaygroundDocument.js';

/**
 * The playground's share link — checklist P3.
 *
 * A link *is* the artefact: nothing is stored server-side, so the codec below is the whole
 * of "share this". That makes it worth locking down properly — a link that survives being
 * pasted into a chat client is the difference between a playground people use to explain
 * something to each other and one they screenshot.
 */
const SURVEY: SurveyDefinition = {
  title: 'Customer feedback',
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'who', title: 'Your name' },
        { type: 'radiogroup', name: 'how', title: 'How was it?', choices: ['Great', 'Poor'] },
      ],
    },
  ],
};

/** What a route hands over when the parameter is not in the URL at all. */
function Route_absent(): string | undefined {
  return undefined;
}

describe('parity/P3-share-link', () => {
  test('a definition survives the round trip exactly', () => {
    expect(decodeDefinition(encodeDefinition(SURVEY))).toEqual(SURVEY);
  });

  test('the encoding carries nothing a URL or a chat client will argue with', () => {
    const encoded = encodeDefinition(SURVEY);

    // Base64url, so no `+`, `/` or `=` — and crucially no `%7B`, which is what makes a
    // percent-encoded definition break when an auto-linker guesses where the URL ends.
    expect(encoded).toMatch(/^[A-Za-z0-9\-_]+$/u);
    expect(encodeURIComponent(encoded)).toBe(encoded);
  });

  test('a survey written in another script round-trips', () => {
    const japanese: SurveyDefinition = { title: 'アンケート', pages: [{ name: 'p1' }] };

    // `btoa` accepts latin1 only, so this throws without the UTF-8 step — and it throws on
    // the *author's* title, which is exactly the survey somebody most wants to share.
    expect(decodeDefinition(encodeDefinition(japanese))).toEqual(japanese);
  });

  test('a truncated link opens the playground rather than an error', () => {
    const encoded = encodeDefinition(SURVEY);

    // Chat clients truncate. Somebody arriving at half a link wants a playground, not a
    // diagnosis of a stranger's paste — the definition is the only thing lost, and it was
    // never ours.
    expect(decodeDefinition(encoded.slice(0, Math.floor(encoded.length / 2)))).toBeUndefined();
    expect(decodeDefinition('not-base64-at-all!!')).toBeUndefined();
    expect(decodeDefinition(Route_absent())).toBeUndefined();
    expect(decodeDefinition('')).toBeUndefined();
  });

  test('a link that decodes to something other than a survey is refused', () => {
    // `?d=` carrying a number leaves the Creator with nothing to open at all, which is a
    // worse failure than an ignored parameter. `parseSurvey` is the real validator; this
    // only has to stop what it could not be handed.
    expect(decodeDefinition(encodeDefinition(42 as unknown as SurveyDefinition))).toBeUndefined();
    expect(decodeDefinition(encodeDefinition([] as unknown as SurveyDefinition))).toBeUndefined();
  });

  test('the link is built against the origin the page is actually on', () => {
    const link = shareLink(SURVEY, 'https://kajay.io', '/playground');

    // Not a hard-coded production origin: the same button has to work on localhost and on
    // a preview deployment, and a link that always said kajay.io would be wrong in both.
    expect(link.startsWith('https://kajay.io/playground?d=')).toBe(true);
    expect(decodeDefinition(new URL(link).searchParams.get('d') ?? undefined)).toEqual(SURVEY);
  });
});
