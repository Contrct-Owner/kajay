import { MetadataRegistry, parseSurvey, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition, SurveyElement } from '@kajay/core';
import { DesignSurface } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

/**
 * The blanks editor: a type picker, and prose that keeps up — checklist C13, ADR-0048.
 *
 * Every test here is a definition the Creator used to be able to produce and the parser
 * refuses. That is the shape of the whole row: a blank is a place in a sentence, so the
 * collection and the prose are one thing being edited in two views.
 */
const SENTENCE: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        {
          type: 'fillintheblank',
          name: 'q1',
          template: 'The [[capital]] of France is [[currency]].',
          blanks: [
            { type: 'text', name: 'capital' },
            { type: 'text', name: 'currency' },
          ],
        },
      ],
    },
  ],
};

function registry(): MetadataRegistry {
  const created = new MetadataRegistry();
  registerBuiltInTypes(created);
  return created;
}

function surface(definition: SurveyDefinition = SENTENCE): DesignSurface {
  return new DesignSurface({ definition, registry: registry() });
}

function sentence(designed: DesignSurface): SurveyElement {
  const found = designed.survey.getQuestionByName('q1');
  if (found === undefined) {
    throw new Error('No question called "q1".');
  }
  designed.select(found);
  return found;
}

/** The first element on the first page, as the designer's own JSON holds it. */
function authored(designed: DesignSurface): SurveyDefinition {
  const pages = (designed.definition.pages ?? []) as readonly SurveyDefinition[];
  const elements = (pages[0]?.['elements'] ?? []) as readonly SurveyDefinition[];
  const element = elements[0];
  if (element === undefined) {
    throw new Error('The page has no elements.');
  }
  return element;
}

function templateOf(designed: DesignSurface): unknown {
  return authored(designed)['template'];
}

/** What the parser makes of what the designer has built. */
function complaints(designed: DesignSurface): readonly string[] {
  return parseSurvey(designed.definition, registry()).diagnostics.map(
    (diagnostic) => `${diagnostic.severity}:${diagnostic.code}`,
  );
}

describe('parity/C13-blanks-editor', () => {
  test('the picker offers the types that can sit in a line of prose, and no others', () => {
    const designed = surface();

    const blanks = designed.collections(sentence(designed)).find((row) => row.property === 'blanks');

    // All nineteen concrete question types used to be on offer here — a matrix, a file
    // upload, another sentence — each of which the parser refuses as `non-inline-blank`
    // the moment it is added. The registry answers, so a host's own inline type is
    // offered the day it registers.
    expect(blanks?.types).toEqual(['boolean', 'dropdown', 'expression', 'rating', 'tagbox', 'text']);
  });

  test('a collection nothing positions still offers everything its base has', () => {
    const designed = surface({
      pages: [{ name: 'p1', elements: [{ type: 'matrixdynamic', name: 'grid', columns: [] }] }],
    });
    const grid = designed.survey.getQuestionByName('grid');
    designed.select(grid!);

    // The filter is the *collection's* rule, not a new rule about questions: a matrix
    // column is a question too and a matrix column may be anything.
    const columns = designed.collections(grid!).find((row) => row.property === 'columns');
    expect(columns?.types).toContain('matrixdynamic');
  });

  test('a blank arrives positioned, or nobody would ever see it', () => {
    const designed = surface();

    expect(designed.addChild(sentence(designed), 'blanks', 'dropdown')).toBeUndefined();

    // Declared and placed, in one edit. Adding used to leave the blank out of the prose,
    // which is a field the designer cannot see and the respondent never gets.
    expect(templateOf(designed)).toBe('The [[capital]] of France is [[currency]]. [[dropdown1]]');
    expect(complaints(designed)).toEqual([]);
  });

  test('deleting a blank takes its marker with it', () => {
    const designed = surface();

    expect(designed.removeChild(sentence(designed), 'blanks', 1)).toBeUndefined();

    // `[[currency]]` left behind would name a blank nobody declares, which is an error
    // rather than a blemish. The space in front of it goes too, or the full stop is left
    // adrift from the word it belongs to.
    expect(templateOf(designed)).toBe('The [[capital]] of France is.');
    expect(complaints(designed)).toEqual([]);
  });

  test('renaming a blank moves its marker', () => {
    const designed = surface();
    sentence(designed);

    expect(designed.rename('capital', 'city')).toBeUndefined();

    expect(templateOf(designed)).toBe('The [[city]] of France is [[currency]].');
    expect(complaints(designed)).toEqual([]);
  });

  test('every language keeps the same set of blanks', () => {
    const designed = surface({
      pages: [
        {
          name: 'p1',
          elements: [
            {
              type: 'fillintheblank',
              name: 'q1',
              template: { default: 'The [[capital]] of France.', fr: 'La [[capital]] de France.' },
              blanks: [{ type: 'text', name: 'capital' }],
            },
          ],
        },
      ],
    });

    expect(designed.addChild(sentence(designed), 'blanks', 'text')).toBeUndefined();

    // A marker is a name rather than words, so it belongs in every language: one added to
    // the default prose alone is `locale-blank-mismatch` the moment a translation exists.
    // The translator moves it where it reads, exactly as they may move the ones there.
    expect(templateOf(designed)).toEqual({
      default: 'The [[capital]] of France. [[text1]]',
      fr: 'La [[capital]] de France. [[text1]]',
    });
    expect(complaints(designed)).toEqual([]);
  });

  test('a sentence and its blanks are one press of undo', () => {
    const designed = surface();
    const before = designed.definition;

    designed.addChild(sentence(designed), 'blanks', 'text');
    designed.undo();

    // The prose and the collection moved together, so they come back together: two edits
    // would leave a definition nobody authored one press in.
    expect(designed.definition).toEqual(before);
  });

  test('an ordinary collection is edited exactly as before', () => {
    const designed = surface({
      pages: [{ name: 'p1', elements: [{ type: 'radiogroup', name: 'tier', choices: ['bronze'] }] }],
    });
    const tier = designed.survey.getQuestionByName('tier');
    designed.select(tier!);

    expect(designed.addChild(tier!, 'choices', 'itemvalue')).toBeUndefined();

    expect(authored(designed)['choices']).toEqual([{ value: 'bronze' }, { value: 'value1' }]);
  });
});
