import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { PropertyValue, SurveyDefinition, SurveyElement } from '@kajay/core';
import { DesignSurface, localizedTextIn } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

/**
 * The localizable-string editor — checklist L2.
 *
 * Its own file beside `propertyEdits.test.ts`, which is about writing *a* value; these are
 * about writing one language of one, which has its own rules about what survives.
 */
function surface(definition: SurveyDefinition = BASIC): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition, registry });
}

const BASIC: SurveyDefinition = {
  pages: [{ name: 'p1', elements: [{ type: 'text', name: 'who', title: 'Your name' }] }],
};

function selectByName(designed: DesignSurface, name: string): SurveyElement {
  const element = designed.page?.elements.find((candidate) => candidate.name === name);
  if (element === undefined) {
    throw new Error(`No element called "${name}".`);
  }
  designed.select(element);
  return element;
}

function rowFor(designed: DesignSurface, element: SurveyElement, name: string) {
  return designed
    .properties(element)
    .flatMap((category) => category.rows)
    .find((row) => row.name === name);
}

function elementIn(definition: SurveyDefinition, name: string): Record<string, PropertyValue> {
  const pages = definition['pages'] as readonly SurveyDefinition[];
  const elements = pages[0]!['elements'] as readonly SurveyDefinition[];
  return (elements.find((element) => element['name'] === name) ?? {}) as Record<
    string,
    PropertyValue
  >;
}

describe('parity/L2-translations', () => {
  const FRENCH: SurveyDefinition = {
    locale: 'fr',
    pages: [
      {
        name: 'p1',
        elements: [{ type: 'text', name: 'who', title: { default: 'Name', fr: 'Nom' } }],
      },
    ],
  };

  test('the languages offered are the ones written, plus default, plus the survey’s', () => {
    const designed = surface(FRENCH);
    const row = rowFor(designed, selectByName(designed, 'who'), 'title');

    expect(row?.locales).toEqual(['default', 'fr']);
  });

  test('a property that is not localizable offers none', () => {
    const designed = surface();

    expect(rowFor(designed, selectByName(designed, 'who'), 'visibleIf')?.locales).toEqual([]);
  });

  test('the survey’s own language is offered even before anything is written in it', () => {
    const designed = surface({
      locale: 'de',
      pages: [{ name: 'p1', elements: [{ type: 'text', name: 'who', title: 'Name' }] }],
    });

    // Offering every language *except* the one on screen would be absurd.
    expect(rowFor(designed, selectByName(designed, 'who'), 'title')?.locales).toEqual([
      'default',
      'de',
    ]);
  });

  test('an untranslated string reads as the default language', () => {
    const designed = surface();
    const row = rowFor(designed, selectByName(designed, 'who'), 'title');

    // Which is what makes adding a second language a matter of typing in the field
    // beside it rather than retyping what is already there.
    expect(localizedTextIn(row?.value, 'default')).toBe('Your name');
    expect(localizedTextIn(row?.value, 'fr')).toBe('');
    expect(localizedTextIn({ default: 'Name', fr: 'Nom' }, 'fr')).toBe('Nom');
  });

  test('a language is written without touching the others', () => {
    const designed = surface(FRENCH);
    const who = selectByName(designed, 'who');

    expect(designed.setLocalized(who, 'title', 'de', 'Name auf Deutsch')).toBeUndefined();

    expect(elementIn(designed.definition, 'who')['title']).toEqual({
      default: 'Name',
      fr: 'Nom',
      de: 'Name auf Deutsch',
    });
  });

  test('an untranslated string becomes the default language', () => {
    const designed = surface();
    const who = selectByName(designed, 'who');

    designed.setLocalized(who, 'title', 'fr', 'Nom');

    // A value that was never translated *is* the default language, which is what makes
    // adding a second one a matter of typing in the field beside it.
    expect(elementIn(designed.definition, 'who')['title']).toEqual({
      default: 'Your name',
      fr: 'Nom',
    });
  });

  test('clearing the last translation gives the plain string back', () => {
    const designed = surface(FRENCH);
    const who = selectByName(designed, 'who');

    designed.setLocalized(who, 'title', 'fr', '');

    // `{ default: 'Name' }` and `'Name'` mean the same thing, and leaving the object
    // behind would make a survey that had once been translated permanently different
    // from one that never was.
    expect(elementIn(designed.definition, 'who')['title']).toBe('Name');
  });

  test('clearing every language removes the property', () => {
    const designed = surface(FRENCH);
    const who = selectByName(designed, 'who');

    designed.setLocalized(who, 'title', 'fr', '');
    designed.setLocalized(who, 'title', 'default', '');

    expect(elementIn(designed.definition, 'who')['title']).toBeUndefined();
  });

  test('a property the registry does not call localizable is refused', () => {
    const designed = surface();
    const who = selectByName(designed, 'who');

    // Storing `{ default: … }` in one that is not localizable would produce a shape every
    // reader of it treats as an object rather than as words.
    expect(designed.setLocalized(who, 'visibleIf', 'fr', '{x} = 1')?.kind).toBe('not-localizable');
    expect(designed.setLocalized(who, 'title', '', 'Nothing')?.kind).toBe('not-localizable');
  });
});
