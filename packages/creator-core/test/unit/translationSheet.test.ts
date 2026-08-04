import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface, TranslationSession } from '@kajay/creator-core';
import { translationCells, translationRows } from '../../src/translationSheet.js';
import { afterEach, describe, expect, test } from 'vitest';

/**
 * Taking the table away and bringing it back — checklist M4's import/export.
 *
 * Its own file beside `translationEditor.test.ts`: that one is about the table, this one is
 * about the rectangle it turns into and what happens when a translator sends it back.
 */
const BASIC: SurveyDefinition = {
  title: { default: 'A survey', fr: 'Un sondage' },
  pages: [{ name: 'p1', elements: [{ type: 'text', name: 'who', title: 'Your name' }] }],
};

const open: TranslationSession[] = [];

function surface(): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition: BASIC, registry });
}

function session(designed: DesignSurface): TranslationSession {
  const made = new TranslationSession(designed);
  open.push(made);
  return made;
}

afterEach(() => {
  for (const made of open.splice(0)) {
    made.dispose();
  }
});

describe('parity/M4-translation-sheet', () => {
  test('the rectangle carries the key, the context and a column per language', () => {
    const designed = surface();
    const made = session(designed);
    const rows = translationRows(made.entries, made.locales);

    expect(rows[0]).toEqual(['key', 'context', 'default', 'fr']);
    expect(rows[1]?.[0]).toBe('survey/title');
    expect(rows[1]?.[3]).toBe('Un sondage');
  });

  test('columns come back by their header, not by their position', () => {
    const cells = translationCells([
      ['context', 'de', 'key'],
      ['ignored', 'Eine Umfrage', 'survey/title'],
    ]);

    // A translator who added a language, removed one or moved them about still sends back
    // something usable, which is most of what happens to a file once it leaves.
    expect(cells).toEqual([{ key: 'survey/title', locale: 'de', text: 'Eine Umfrage' }]);
  });

  test('a sheet with no key column is refused rather than half-read', () => {
    // Guessing the first column would silently write every translation onto the wrong
    // string.
    expect(
      translationCells([
        ['context', 'de'],
        ['x', 'y'],
      ]),
    ).toEqual([]);
  });

  test('importing reports what landed and what no longer exists', () => {
    const designed = surface();
    const made = session(designed);

    const result = made.applyRows([
      ['key', 'de'],
      ['survey/title', 'Eine Umfrage'],
      ['survey/pages/p1/elements/gone/title', 'Weg'],
    ]);

    // A count of one with no mention of the other is how a survey ships with a language
    // nobody notices is missing a string.
    expect(result.applied).toBe(1);
    expect(result.unmatched).toEqual(['survey/pages/p1/elements/gone/title']);
  });

  test('an unchanged cell is not an edit', () => {
    const designed = surface();
    const made = session(designed);

    const result = made.applyRows([
      ['key', 'fr'],
      ['survey/title', 'Un sondage'],
    ]);

    // Importing a file nobody touched would otherwise be a hundred undo entries and a
    // survey that reports itself modified.
    expect(result.applied).toBe(0);
    expect(designed.canUndo).toBe(false);
  });

  test('a round trip through CSV changes nothing', () => {
    const designed = surface();
    const made = session(designed);

    const result = made.applyCsv(made.toCsv());

    expect(result).toEqual({ applied: 0, unmatched: [] });
  });
});
