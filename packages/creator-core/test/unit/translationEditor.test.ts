import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface, TranslationSession } from '@kajay/creator-core';
import type { TranslationRequest } from '@kajay/creator-core';
import { collectTranslations } from '../../src/translations.js';
import { afterEach, describe, expect, test } from 'vitest';

/**
 * The translation editor — checklist M4.
 *
 * Its own file beside `translations.test.ts`, which is L2's: that one is about writing one
 * language of one property, this one is about the survey-wide table over it.
 */
const BASIC: SurveyDefinition = {
  title: { default: 'A survey', fr: 'Un sondage' },
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'who', title: 'Your name' },
        {
          type: 'radiogroup',
          name: 'tier',
          title: 'Which tier?',
          choices: [{ value: 'bronze', text: 'Bronze' }, 'silver'],
        },
      ],
    },
  ],
};

const open: TranslationSession[] = [];

function surface(definition: SurveyDefinition = BASIC): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition, registry });
}

function session(designed: DesignSurface, options = {}): TranslationSession {
  const made = new TranslationSession(designed, options);
  open.push(made);
  return made;
}

function keys(designed: DesignSurface): readonly string[] {
  return collectTranslations(designed.survey, designed.registry).map((entry) => entry.key);
}

afterEach(() => {
  for (const made of open.splice(0)) {
    made.dispose();
  }
});

describe('parity/M4-translations', () => {
  test('every localizable string is found by walking the registry', () => {
    const found = keys(surface());

    // Nothing here names a property or a type. The survey's own title, a question's, a
    // choice item's `text` — all of it is `isLocalizable` plus `getChildCollections`.
    expect(found).toContain('survey/title');
    expect(found).toContain('survey/pages/p1/elements/who/title');
    expect(found).toContain('survey/pages/p1/elements/tier/choices/bronze/text');
  });

  test('a key is built from names, not from positions', () => {
    const designed = surface();

    designed.place(
      { kind: 'move', name: 'tier' },
      { list: { of: 'elements', container: 'p1' }, index: 0 },
    );

    // A translator sends the file back a week later, and a question that has moved must
    // not take somebody's German with it to the wrong row.
    expect(keys(designed)).toContain('survey/pages/p1/elements/who/title');
  });

  test('a choice with no name is identified by its value', () => {
    // `silver` is authored as a bare string, so the parser expands it to `{ value }` and
    // there is no name to key on. What it stores is the only stable thing about it.
    expect(keys(surface())).toContain('survey/pages/p1/elements/tier/choices/silver/text');
  });

  test('a custom localizable property turns up with nothing added here', () => {
    const registry = new MetadataRegistry();
    registerBuiltInTypes(registry);
    registry.addProperty('text', { name: 'hint', type: 'string', isLocalizable: true });
    const designed = new DesignSurface({ definition: BASIC, registry });

    expect(keys(designed)).toContain('survey/pages/p1/elements/who/hint');
  });

  test('the languages are the ones already written in, plus default', () => {
    const made = session(surface());

    expect(made.locales).toEqual(['default', 'fr']);
  });

  test('a survey with no translations at all still has a column to translate from', () => {
    const made = session(
      surface({ pages: [{ name: 'p1', elements: [{ type: 'text', name: 'who' }] }] }),
    );

    expect(made.locales).toEqual(['default']);
  });

  test('the table is derived, so a new question has a row without being told', () => {
    const designed = surface();
    const made = session(designed);
    const before = made.entries.length;

    designed.place(
      {
        kind: 'new',
        item: { name: 'text', type: 'text', title: 'Text', category: 'x', keywords: [], defaults: {} },
      },
      { list: { of: 'elements', container: 'p1' }, index: 0 },
    );

    // There is no second list of strings to fall out of step with the survey, which is the
    // failure mode every translation tool has.
    expect(made.entries.length).toBeGreaterThan(before);
  });

  test('writing a translation goes through the localized setter, and is undoable', () => {
    const designed = surface();
    const made = session(designed);
    const who = made.entries.find((entry) => entry.key.endsWith('elements/who/title'));

    expect(made.setText(who!, 'fr', 'Votre nom')).toBeUndefined();

    // L2's rule: a language is written into the property in place, never over the others.
    expect(designed.survey.getQuestionByName('who')?.getPropertyValue('title')).toEqual({
      default: 'Your name',
      fr: 'Votre nom',
    });
    designed.undo();
    expect(designed.survey.getQuestionByName('who')?.getPropertyValue('title')).toBe('Your name');
  });
});

describe('parity/M4-translation-columns', () => {
  test('adding a language opens a column, not a hundred empty translations', () => {
    const designed = surface();
    const made = session(designed);

    expect(made.addLocale('de')).toBe(true);

    expect(made.locales).toContain('de');
    expect(JSON.stringify(designed.definition)).not.toContain('"de"');
    // Nothing was written, so there is nothing to take back. A column that quietly wrote
    // `{ de: "" }` into every string would leave a hundred undo entries behind it.
    expect(designed.canUndo).toBe(false);
  });

  test('a language already there is not added twice', () => {
    const made = session(surface());

    expect(made.addLocale('fr')).toBe(false);
    expect(made.addLocale('  ')).toBe(false);
  });

  test('an empty column closes; one with translations in it does not', () => {
    const designed = surface();
    const made = session(designed);
    made.addLocale('de');

    expect(made.removeLocale('de')).toBe(true);
    expect(made.locales).not.toContain('de');

    made.addLocale('de');
    made.setText(made.entries[0]!, 'de', 'Eine Umfrage');
    // There is no such thing as hiding a language that exists: "remove" would have to mean
    // "delete every German string in the survey", which is a real operation and not this
    // one. Making one button mean both is how somebody loses a week's work.
    expect(made.removeLocale('de')).toBe(false);
  });

  test('what is missing is counted per language', () => {
    const made = session(surface());

    // Only the survey's own title is in French, and only the strings that say something
    // in `default` can be missing a translation at all.
    const translatable = made.entries.filter((entry) => made.textIn(entry, 'default').length > 0);
    expect(made.missingIn('fr')).toBe(translatable.length - 1);
    expect(made.missingIn('default')).toBe(0);
  });
});

/** A pretend service that answers in order, which is the contract a batch rests on. */
function echo(request: TranslationRequest): Promise<readonly string[]> {
  return Promise.resolve(request.texts.map((text) => `${text} [${request.to}]`));
}

describe('parity/M4-machine-translation', () => {
  test('one call carries every untranslated string', async () => {
    const designed = surface();
    const calls: TranslationRequest[] = [];
    const made = session(designed, {
      translate: (request: TranslationRequest) => {
        calls.push(request);
        return echo(request);
      },
    });
    made.addLocale('de');

    const result = await made.translateInto('de');

    // A service charged per request would otherwise be billed once per title.
    expect(calls).toHaveLength(1);
    expect(result.filled).toBe(calls[0]?.texts.length);
    expect(result.error).toBeUndefined();
  });

  test('it never writes over a translation a person wrote', async () => {
    const designed = surface();
    const made = session(designed, { translate: echo });

    await made.translateInto('fr');

    // The whole reason a person wrote it is that the machine got it wrong, and running
    // this twice has to be safe.
    const title = made.entries.find((entry) => entry.key === 'survey/title');
    expect(made.textIn(title!, 'fr')).toBe('Un sondage');
  });

  test('a service that hands back the wrong number of strings is refused entirely', async () => {
    const designed = surface();
    const made = session(designed, { translate: () => Promise.resolve(['only one']) });
    made.addLocale('de');

    const result = await made.translateInto('de');

    // The alignment is positional, so a short answer does not mean "some failed" — it means
    // every string after the gap now carries somebody else's translation.
    expect(result.filled).toBe(0);
    expect(result.error).toContain('received 1');
    expect(JSON.stringify(designed.definition)).not.toContain('only one');
  });

  test('a rejection is reported rather than thrown at the caller', async () => {
    const made = session(surface(), {
      translate: () => Promise.reject(new Error('quota exceeded')),
    });
    made.addLocale('de');

    const result = await made.translateInto('de');

    expect(result).toEqual({ filled: 0, error: 'quota exceeded' });
  });

  test('with no service configured it says so rather than doing nothing', async () => {
    const made = session(surface());

    expect(await made.translateInto('fr')).toEqual({
      filled: 0,
      error: 'No translation service is configured.',
    });
  });
});
