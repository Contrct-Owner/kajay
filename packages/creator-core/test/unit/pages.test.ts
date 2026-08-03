import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { addPage, applyPlacement, DesignSurface, pageAfterRemoving, removePage } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

/** Page management — checklist K4. */
function threePages(): SurveyDefinition {
  return {
    pages: [
      { name: 'p1', elements: [{ type: 'text', name: 'who' }] },
      { name: 'p2', elements: [{ type: 'text', name: 'why' }] },
      { name: 'p3', elements: [] },
    ],
  };
}

function pageNames(definition: SurveyDefinition): readonly string[] {
  return (definition['pages'] as readonly SurveyDefinition[]).map((page) => page['name'] as string);
}

function surface(definition: SurveyDefinition = threePages()): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition, registry });
}

describe('parity/K4-add-page', () => {
  test('an empty page is appended', () => {
    const after = addPage(threePages());

    expect(pageNames(after)).toEqual(['p1', 'p2', 'p3', 'page1']);
  });

  test('a page name avoids what a question has taken', () => {
    const after = addPage({ pages: [{ name: 'intro', elements: [{ type: 'text', name: 'page1' }] }] });

    // A page shares the name space with every question, because `{page1}` in an
    // expression has to mean one thing. Untidy numbering beats a collision.
    expect(pageNames(after)).toEqual(['intro', 'page2']);
  });

  test('a survey with no pages at all gains its first', () => {
    expect(pageNames(addPage({}))).toEqual(['page1']);
  });
});

describe('parity/K4-remove-page', () => {
  test('the page goes, and so does everything on it', () => {
    const after = removePage(threePages(), 'p1');

    expect(pageNames(after)).toEqual(['p2', 'p3']);
    expect(JSON.stringify(after)).not.toContain('who');
  });

  test('removing a page that is not there gives back what it was given', () => {
    const before = threePages();

    // Identity, so a caller can tell nothing happened without comparing surveys.
    expect(removePage(before, 'ghost')).toBe(before);
  });

  test('the last page can go', () => {
    const after = removePage({ pages: [{ name: 'only', elements: [] }] }, 'only');

    // Refusing would mean a designer cannot delete a page they do not want without
    // first adding a replacement — and a survey with no pages is the state every new
    // one starts in, which the canvas already renders and says so.
    expect(pageNames(after)).toEqual([]);
  });
});

describe('parity/K4-landing', () => {
  test('the canvas lands on the page that took its place', () => {
    expect(pageAfterRemoving(threePages(), 'p2')).toBe('p3');
  });

  test('removing the last page lands on the one before it', () => {
    // Never nothing while a page remains: a designer who deletes the last page is still
    // looking at the survey, and an empty canvas would read as having deleted rather
    // more than they asked for.
    expect(pageAfterRemoving(threePages(), 'p3')).toBe('p2');
  });

  test('removing the only page lands nowhere, because there is nowhere', () => {
    expect(pageAfterRemoving({ pages: [{ name: 'only', elements: [] }] }, 'only')).toBeUndefined();
  });

  test('a page that is not there has no landing place', () => {
    expect(pageAfterRemoving(threePages(), 'ghost')).toBeUndefined();
  });
});

describe('parity/K4-page-surface', () => {
  test('adding a page moves the canvas to it', () => {
    const designed = surface();

    designed.addPage();

    // A designer adds a page in order to put something on it. One that appeared
    // somewhere off-screen would have to be found first.
    expect(designed.pages.map((page) => page.name)).toEqual(['p1', 'p2', 'p3', 'page1']);
    expect(designed.page?.name).toBe('page1');
  });

  test('removing the page being looked at moves to its neighbour', () => {
    const designed = surface();
    designed.goToPage('p2');

    expect(designed.removePage('p2')).toBe(true);
    expect(designed.page?.name).toBe('p3');
  });

  test('removing another page leaves the canvas where it was', () => {
    const designed = surface();
    designed.goToPage('p3');

    designed.removePage('p1');

    expect(designed.page?.name).toBe('p3');
  });

  test('removing a page that is not there announces nothing', () => {
    const designed = surface();
    const seen: number[] = [];
    designed.onChanged.add((version) => seen.push(version));

    expect(designed.removePage('ghost')).toBe(false);
    expect(seen).toEqual([]);
  });

  test('switching page clears the selection', () => {
    const designed = surface();
    designed.select(designed.survey.getQuestionByName('who')!);

    designed.goToPage('p2');

    // What was selected is not on screen any more. Leaving it selected would leave the
    // property grid editing something the designer cannot see.
    expect(designed.selected).toBeUndefined();
    expect(designed.page?.name).toBe('p2');
  });

  test('switching to the page already on the canvas announces nothing', () => {
    const designed = surface();
    const seen: number[] = [];
    designed.onChanged.add((version) => seen.push(version));

    designed.goToPage('p1');

    expect(seen).toEqual([]);
  });
});

describe('parity/K4-reorder-pages', () => {
  test('a page moves through the same placement questions do', () => {
    const after = applyPlacement(
      threePages(),
      { kind: 'move', name: 'p1' },
      { list: { of: 'pages' }, index: 3 },
    );

    // The same function, the same off-by-one correction, the same refusals. Reordering
    // pages needed no second implementation because a slot names its list.
    expect(pageNames(after)).toEqual(['p2', 'p3', 'p1']);
  });

  test('the questions travel with the page', () => {
    const designed = surface();

    designed.place({ kind: 'move', name: 'p1' }, { list: { of: 'pages' }, index: 3 });

    expect(designed.pages.map((page) => page.name)).toEqual(['p2', 'p3', 'p1']);
    expect(designed.survey.getQuestionByName('who')).toBeDefined();
  });

  test('a moved page is the page selected', () => {
    const designed = surface();

    designed.place({ kind: 'move', name: 'p2' }, { list: { of: 'pages' }, index: 0 });

    // Dragging something is a deliberate act on it, whether it is a question or a page.
    // Re-resolving the selection therefore has to look among pages as well as among the
    // current page's elements — a page is not on the canvas, and it is still selectable.
    expect(designed.selected?.getPropertyValue('name')).toBe('p2');
    expect(designed.isSelected(designed.pages[0]!)).toBe(true);
  });

  test('a moved page is the page still being looked at', () => {
    const designed = surface();

    designed.place({ kind: 'move', name: 'p1' }, { list: { of: 'pages' }, index: 3 });

    // The canvas does not follow the page — `#reparse` restores the page by name, and
    // p1 is still called p1 wherever it now sits in the order.
    expect(designed.page?.name).toBe('p1');
  });
});
