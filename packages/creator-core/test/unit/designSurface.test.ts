import { MetadataRegistry, registerBuiltInTypes, serializeSurvey } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface } from '@kajay/creator-core';
import type { ToolboxItem } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

const TEXT_ITEM: ToolboxItem = {
  name: 'text',
  type: 'text',
  title: 'Single-line input',
  category: 'Text',
  keywords: [],
  defaults: {},
};

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

function elementNames(designed: DesignSurface): readonly string[] {
  return (designed.page?.elements ?? []).map((element) => element.name);
}

describe('parity/K2-place', () => {
  test('a dropped item becomes a question the survey knows', () => {
    const designed = surface();

    designed.place({ kind: 'new', item: TEXT_ITEM }, { container: 'p1', index: 1 });

    // Not merely present in an array: named, addressable and wired, because the whole
    // survey went back through `parseSurvey` (ADR-0009 decision 3). Assembling an
    // element by hand against the live model is what this avoids.
    expect(elementNames(designed)).toEqual(['who', 'text1', 'plan']);
    expect(designed.survey.getQuestionByName('text1')?.type).toBe('text');
  });

  test('the survey is still on a canvas after a re-parse', () => {
    const designed = surface();

    designed.place({ kind: 'new', item: TEXT_ITEM }, { container: 'p1', index: 0 });

    // Design mode is runtime state, so it is exactly what a re-parse throws away —
    // and a canvas whose questions started answering after the first drop would be
    // K3 quietly undone by K2.
    expect(designed.survey.isDesignMode).toBe(true);
    expect(designed.survey.getQuestionByName('plan')?.isReadOnly).toBe(true);
  });

  test('what was placed is what is selected', () => {
    const designed = surface();
    designed.select(designed.survey.getQuestionByName('who')!);

    designed.place({ kind: 'new', item: TEXT_ITEM }, { container: 'p1', index: 0 });

    // A designer who drops a question wants to name it next. Leaving the selection
    // where it was would send the very next keystroke to the wrong element.
    expect(designed.selected?.getPropertyValue('name')).toBe('text1');
  });

  test('a drag selects what was dragged, whatever was selected before', () => {
    const designed = surface();
    designed.select(designed.survey.getQuestionByName('plan')!);

    designed.place({ kind: 'move', element: 'who' }, { container: 'p1', index: 2 });

    // Dragging something is a deliberate act on it, so it is what the designer is
    // thinking about when the drag ends. The selection is re-resolved *by name*,
    // because nothing survives a re-parse by identity — the object is a different
    // one and `isSelected` still has to agree it is the same question.
    expect(designed.selected?.getPropertyValue('name')).toBe('who');
    expect(designed.isSelected(designed.survey.getQuestionByName('who')!)).toBe(true);
    expect(designed.isSelected(designed.survey.getQuestionByName('plan')!)).toBe(false);
  });

  test('an edit made before the drop is still there after it', () => {
    const designed = surface();
    designed.setTitle(designed.survey.getQuestionByName('who')!, 'What is your name?');

    designed.place({ kind: 'move', element: 'who' }, { container: 'p1', index: 2 });

    // Property edits mutate the model and structural edits re-parse, so a drop has to
    // serialize what is on the canvas rather than the definition it was opened with.
    // Every drop is therefore a round trip through ADR-0002's fixed point.
    expect(designed.survey.getQuestionByName('who')?.title).toBe('What is your name?');
  });

  test('a drop announces once, and a refused one not at all', () => {
    const designed = surface();
    const seen: number[] = [];
    designed.onChanged.add((version) => seen.push(version));

    expect(designed.place({ kind: 'move', element: 'who' }, { container: 'p1', index: 2 })).toBe(
      true,
    );
    expect(designed.place({ kind: 'move', element: 'who' }, { container: 'p1', index: 2 })).toBe(
      false,
    );

    expect(seen).toHaveLength(1);
    expect(elementNames(designed)).toEqual(['plan', 'who']);
  });

  test('the page being looked at is the page still being looked at', () => {
    const designed = new DesignSurface({
      definition: {
        pages: [
          { name: 'p1', elements: [{ type: 'text', name: 'first' }] },
          { name: 'p2', elements: [{ type: 'text', name: 'second' }] },
        ],
      },
      registry: registry(),
    });
    designed.survey.goTo('p2');

    designed.place({ kind: 'new', item: TEXT_ITEM }, { container: 'p2', index: 0 });

    // A re-parse starts on page one. A drop that scrolled the designer back there
    // would land the edit correctly and lose the canvas its place.
    expect(designed.page?.name).toBe('p2');
  });

  test('the slots offered are the ones the page has', () => {
    const designed = surface();

    expect(designed.slots).toEqual([
      { container: 'p1', index: 0 },
      { container: 'p1', index: 1 },
      { container: 'p1', index: 2 },
    ]);
  });
});
