import { parseSurvey, resolveTextDirection } from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

/** Right-to-left support — checklist J3. */
function build(extra: Readonly<Record<string, unknown>>): Survey {
  return parseSurvey(
    { ...extra, pages: [{ name: 'p1', elements: [{ type: 'text', name: 'who' }] }] },
    createTestRegistry(),
  ).survey;
}

describe('parity/J3-rtl', () => {
  test('direction follows the language', () => {
    // A fact about the script, not a preference. An author who translates a survey into
    // Hebrew should not also have to remember to flip a switch — and one who forgets
    // would otherwise ship a survey laid out backwards.
    expect(build({ locale: 'he' }).direction).toBe('rtl');
    expect(build({ locale: 'ar' }).direction).toBe('rtl');
    expect(build({ locale: 'en' }).direction).toBe('ltr');
    expect(build({}).direction).toBe('ltr');
  });

  test('a region never changes the direction', () => {
    expect(build({ locale: 'ar-EG' }).direction).toBe('rtl');
    expect(build({ locale: 'en-GB' }).direction).toBe('ltr');
  });

  test('a definition may state it outright', () => {
    // For what the list cannot know: a private locale tag, or a survey deliberately
    // laid out against its language.
    expect(build({ locale: 'en', textDirection: 'rtl' }).direction).toBe('rtl');
    expect(build({ locale: 'he', textDirection: 'ltr' }).direction).toBe('ltr');
  });

  test('an unrecognised setting falls back to deriving rather than throwing', () => {
    expect(build({ locale: 'he', textDirection: 'sideways' }).direction).toBe('rtl');
  });

  test('switching language switches direction with it', () => {
    const survey = build({ locale: 'en' });
    survey.setLocale('fa');

    expect(survey.direction).toBe('rtl');
  });

  test('the resolver is a pure function a host can call directly', () => {
    expect(resolveTextDirection('ur', 'auto')).toBe('rtl');
    expect(resolveTextDirection('UR', 'auto')).toBe('rtl');
    expect(resolveTextDirection('ur', 'ltr')).toBe('ltr');
  });
});
