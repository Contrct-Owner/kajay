import { MetadataRegistry, registerBuiltInTypes, serializeSurvey } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

/** The design surface model — checklist K3. */
function registry(): MetadataRegistry {
  const created = new MetadataRegistry();
  registerBuiltInTypes(created);
  return created;
}

function surface(definition: SurveyDefinition = BASIC): DesignSurface {
  return new DesignSurface({ definition, registry: registry() });
}

const BASIC: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'who', title: 'Your name' },
        { type: 'radiogroup', name: 'plan', title: 'Which plan?', choices: ['free', 'paid'] },
      ],
    },
  ],
};

describe('parity/K3-design-surface', () => {
  test('it parses the definition it was given, diagnostics and all', () => {
    const designed = surface({
      pages: [{ name: 'p1', department: 'engineering', elements: [] }],
    });

    // A real survey through the same `parseSurvey` a respondent's goes through, which
    // is what makes the surface WYSIWYG rather than a drawing of one.
    expect(designed.survey.pages).toHaveLength(1);
    expect(designed.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'unknown-property',
    ]);
  });

  test('nothing is selected to begin with, and selecting announces once', () => {
    const designed = surface();
    const seen: number[] = [];
    designed.onChanged.add((version) => seen.push(version));
    const question = designed.survey.getQuestionByName('who');

    expect(designed.selected).toBeUndefined();
    designed.select(question!);
    designed.select(question!);

    expect(designed.isSelected(question!)).toBe(true);
    // Re-selecting what is already selected is not a change, or every click on a
    // selected element would re-render the surface for nothing.
    expect(seen).toHaveLength(1);
  });

  test('clearing the selection is its own act', () => {
    const designed = surface();
    designed.select(designed.survey.getQuestionByName('who')!);

    designed.clearSelection();

    expect(designed.selected).toBeUndefined();
  });

  test('a title is edited and the model is what changed', () => {
    const designed = surface();
    const question = designed.survey.getQuestionByName('who');

    designed.setTitle(question!, 'What is your name?');

    expect(question?.title).toBe('What is your name?');
    const canonical = serializeSurvey(designed.survey) as Record<string, unknown>;
    expect(JSON.stringify(canonical)).toContain('What is your name?');
  });

  test('editing a localized title keeps the other languages', () => {
    const designed = surface({
      locale: 'fr',
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'who', title: { default: 'Your name', fr: 'Votre nom' } },
          ],
        },
      ],
    });
    const question = designed.survey.getQuestionByName('who');

    designed.setTitle(question!, 'Votre nom complet');

    // Overwriting the object with a plain string would drop English the moment somebody
    // fixed a typo in French, and nothing about typing in a text box suggests that is
    // what happened.
    expect(question?.getPropertyValue('title')).toEqual({
      default: 'Your name',
      fr: 'Votre nom complet',
    });
  });

  test('with no locale named, an edit lands on the default entry', () => {
    const designed = surface({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'who', title: { default: 'Your name', fr: 'Votre nom' } },
          ],
        },
      ],
    });

    designed.setTitle(designed.survey.getQuestionByName('who')!, 'Full name');

    expect(designed.survey.getQuestionByName('who')?.getPropertyValue('title')).toEqual({
      default: 'Full name',
      fr: 'Votre nom',
    });
  });

  test('the survey is on a canvas, so nothing on it can be answered', () => {
    const designed = surface();

    // Every question refuses, through E7's existing read-only path — no renderer is
    // told anything, and no `preventDefault` is racing a default action.
    expect(designed.survey.isDesignMode).toBe(true);
    expect(designed.survey.getQuestionByName('who')?.isReadOnly).toBe(true);
  });

  test('design mode is runtime state, not a property somebody wrote', () => {
    const designed = surface();

    // `setReadOnly` would write `readOnly: true` into the definition, so a Creator that
    // reached for it would stamp every survey it opened with a flag the author never
    // wrote. This takes the route `isPreviewing` already takes.
    expect(JSON.stringify(serializeSurvey(designed.survey))).not.toContain('readOnly');
  });

  test('an answer a designer stumbles into never reaches the definition', () => {
    const designed = surface();
    const before = JSON.stringify(serializeSurvey(designed.survey));

    designed.survey.setValue('plan', 'paid');

    // Byte-identical, not merely free of the word: "paid" is legitimately in there as a
    // *choice*, and asserting on the string would have passed for the wrong reason. The
    // two have been separate since E6 — `serializeSurvey` writes the definition and
    // `data` is the response — so a stray click cannot reach what is saved.
    expect(JSON.stringify(serializeSurvey(designed.survey))).toBe(before);
    expect(designed.survey.data).toEqual({ plan: 'paid' });
  });

  test('every edit goes through one path', () => {
    const designed = surface();
    const seen: number[] = [];
    designed.onChanged.add((version) => seen.push(version));

    designed.change(() => {
      designed.survey.setPropertyValue('title', 'Renamed');
    });

    // The chokepoint K6's undo stack will wrap. A setter that announced on its own
    // would be the one nobody remembers to add to the command stack.
    expect(seen).toHaveLength(1);
    expect(designed.survey.title).toBe('Renamed');
  });
});
