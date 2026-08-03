import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface, UndoHistory } from '@kajay/creator-core';
import type { DropList, HistorySnapshot, ToolboxItem } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

/** Undo and redo — checklist K6. */
const P1: DropList = { of: 'elements', container: 'p1' };

const TEXT_ITEM: ToolboxItem = {
  name: 'text',
  type: 'text',
  title: 'Single-line input',
  category: 'Text',
  keywords: [],
  defaults: {},
};

const TWO_PAGES: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'who', title: 'Name' },
        { type: 'text', name: 'why' },
      ],
    },
    { name: 'p2', elements: [{ type: 'text', name: 'when' }] },
  ],
};

function surface(definition: SurveyDefinition = TWO_PAGES): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition, registry });
}

function names(designed: DesignSurface): readonly string[] {
  return (designed.page?.elements ?? []).map((element) => element.name);
}

describe('parity/K6-undo', () => {
  test('a fresh surface has nothing to undo or redo', () => {
    const designed = surface();

    expect(designed.canUndo).toBe(false);
    expect(designed.canRedo).toBe(false);
    expect(designed.undo()).toBe(false);
    expect(designed.redo()).toBe(false);
  });

  test('a placement is taken back', () => {
    const designed = surface();
    designed.place({ kind: 'new', item: TEXT_ITEM }, { list: P1, index: 0 });

    expect(designed.undo()).toBe(true);

    // Undo is a re-parse of a definition the surface kept, not an inverse operation —
    // which is the return on ADR-0009 decision 3. No edit has to know how to undo
    // itself, so no future edit can forget to.
    expect(names(designed)).toEqual(['who', 'why']);
    expect(designed.survey.getQuestionByName('text1')).toBeUndefined();
  });

  test('redo puts it back', () => {
    const designed = surface();
    designed.place({ kind: 'new', item: TEXT_ITEM }, { list: P1, index: 0 });
    designed.undo();

    expect(designed.redo()).toBe(true);
    expect(names(designed)).toEqual(['text1', 'who', 'why']);
    expect(designed.canRedo).toBe(false);
  });

  test('a new edit throws away the redo stack', () => {
    const designed = surface();
    designed.place({ kind: 'new', item: TEXT_ITEM }, { list: P1, index: 0 });
    designed.undo();

    designed.place({ kind: 'move', name: 'who' }, { list: P1, index: 2 });

    // The redo stack described a future that no longer follows from where the survey is.
    expect(designed.canRedo).toBe(false);
    expect(names(designed)).toEqual(['why', 'who']);
  });

  test('adding and removing pages is undone too', () => {
    const designed = surface();
    designed.addPage();
    designed.removePage('p2');

    designed.undo();
    expect(designed.pages.map((page) => page.name)).toEqual(['p1', 'p2', 'page1']);

    designed.undo();
    expect(designed.pages.map((page) => page.name)).toEqual(['p1', 'p2']);
  });

  test('a page comes back with everything that was on it', () => {
    const designed = surface();
    designed.removePage('p2');

    designed.undo();

    // Deleting a page takes its questions with it, so undoing has to bring them back —
    // and it does for free, because the entry is the whole definition.
    expect(designed.survey.getQuestionByName('when')).toBeDefined();
  });

  test('a refused edit records nothing', () => {
    const designed = surface();

    expect(designed.place({ kind: 'move', name: 'who' }, { list: P1, index: 0 })).toBe(false);
    expect(designed.removePage('ghost')).toBe(false);

    // An entry that undoes nothing is worse than no entry: pressing undo would appear
    // to do nothing at all, twice.
    expect(designed.canUndo).toBe(false);
  });
});

describe('parity/K6-undo-place', () => {
  test('undo puts the designer back where the edit happened', () => {
    const designed = surface();
    designed.goToPage('p2');
    designed.place({ kind: 'new', item: TEXT_ITEM }, { list: { of: 'elements', container: 'p2' }, index: 0 });
    designed.goToPage('p1');

    designed.undo();

    // Restoring the survey alone would be correct and disorienting: the change would
    // happen on a page nobody could see.
    expect(designed.page?.name).toBe('p2');
    expect(names(designed)).toEqual(['when']);
  });

  test('undo restores what was selected', () => {
    const designed = surface();
    designed.select(designed.survey.getQuestionByName('why')!);
    designed.place({ kind: 'move', name: 'who' }, { list: P1, index: 2 });

    designed.undo();

    expect(designed.selected?.getPropertyValue('name')).toBe('why');
  });
});

describe('parity/K6-coalesce', () => {
  test('typing a title is one undo, not one per letter', () => {
    const designed = surface();
    const who = designed.survey.getQuestionByName('who')!;

    for (const value of ['N', 'Na', 'Nam', 'Name?']) {
      designed.setTitle(who, value);
    }

    expect(designed.undo()).toBe(true);
    // Back to before the typing started. Giving the letters back one at a time is not
    // what anybody means by undoing a rename.
    expect(designed.survey.getQuestionByName('who')?.title).toBe('Name');
    expect(designed.canUndo).toBe(false);
  });

  test('renaming a different element starts a new entry', () => {
    const designed = surface();
    designed.setTitle(designed.survey.getQuestionByName('who')!, 'First');
    designed.setTitle(designed.survey.getQuestionByName('why')!, 'Second');

    designed.undo();

    // Keyed by element, so two renames are two edits however quickly they follow.
    // Asserted on the *property* rather than on `title`, which falls back to the name
    // when nothing is authored — `why` reads as "why" either way, and the assertion
    // would have passed whether or not the undo landed.
    expect(designed.survey.getQuestionByName('why')?.getPropertyValue('title')).toBeUndefined();
    expect(designed.survey.getQuestionByName('who')?.title).toBe('First');
  });

  test('looking away ends the run', () => {
    const designed = surface();
    const who = designed.survey.getQuestionByName('who')!;
    designed.setTitle(who, 'First');

    designed.select(who);
    designed.setTitle(designed.survey.getQuestionByName('who')!, 'Second');

    designed.undo();

    // Without this, renaming something, going away to do something else and coming back
    // to rename it again would be a single undo, because the key had not changed.
    expect(designed.survey.getQuestionByName('who')?.title).toBe('First');
  });

  test('a jump through time ends the run', () => {
    const designed = surface();
    designed.setTitle(designed.survey.getQuestionByName('who')!, 'First');
    designed.undo();
    designed.redo();

    designed.setTitle(designed.survey.getQuestionByName('who')!, 'Second');
    designed.undo();

    // An edit made after an undo continues nothing, however similar it looks.
    expect(designed.survey.getQuestionByName('who')?.title).toBe('First');
  });
});

function snapshotAt(at: number): HistorySnapshot {
  return { definition: { title: String(at) }, page: undefined, selected: undefined };
}

describe('parity/K6-depth', () => {
  test('the oldest edits are forgotten rather than kept forever', () => {
    const history = new UndoHistory();

    for (let at = 0; at <= 100; at += 1) {
      history.record(snapshotAt(at));
    }

    // An entry is a whole survey definition — this trades memory for never being wrong,
    // and the trade needs a bound.
    let depth = 0;
    while (history.undo(snapshotAt(999)) !== undefined) {
      depth += 1;
    }
    expect(depth).toBe(100);
  });
});
