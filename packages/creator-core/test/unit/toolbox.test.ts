import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import { Toolbox } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

/**
 * The toolbox model — checklist K1.
 *
 * A private registry throughout: the global one is process-wide shared mutable state
 * and these tests register types of their own.
 */
function registry(): MetadataRegistry {
  const created = new MetadataRegistry();
  registerBuiltInTypes(created);
  return created;
}

function toolbox(): Toolbox {
  return new Toolbox({ registry: registry() });
}

function names(box: Toolbox): readonly string[] {
  return box.items.map((item) => item.name);
}

/** What the current search leaves, flattened out of its categories. */
function matched(box: Toolbox): readonly string[] {
  return box.categories.flatMap((category) => category.items).map((item) => item.name);
}

describe('parity/K1-toolbox-registry', () => {
  test('every droppable type is in it, without being listed anywhere', () => {
    const box = toolbox();

    // `pageelement`, not `question`: a panel and an image are things a designer drops
    // on a page and are not questions. A toolbox of questions alone would be missing
    // the two most structural items in it.
    expect(names(box)).toContain('text');
    expect(names(box)).toContain('panel');
    expect(names(box)).toContain('image');
    expect(names(box)).toContain('matrixdynamic');
  });

  test('a custom type appears with nothing added to the toolbox', () => {
    const created = registry();
    created.addClass({
      name: 'starrating',
      parent: 'question',
      properties: [],
      create: () => created.createInstance('text'),
    });

    const box = new Toolbox({ registry: created });

    // The whole claim of the row, and the reason nothing in `Toolbox.ts` lists a type:
    // registering a question is enough to be able to design with it.
    expect(names(box)).toContain('starrating');
  });

  test('a type nobody named still gets a title and a home', () => {
    const created = registry();
    created.addClass({
      name: 'starrating',
      parent: 'question',
      properties: [],
      create: () => created.createInstance('text'),
    });
    const item = new Toolbox({ registry: created }).items.find(
      (candidate) => candidate.name === 'starrating',
    );

    // Plainly a fallback rather than a guess dressed up as a name — a host who has not
    // supplied a title should be able to see that they have not.
    expect(item?.title).toBe('Starrating');
    expect(item?.category).toBe('Other');
  });

  test('the built-in types are named for designers, not for the format', () => {
    const box = toolbox();
    const item = box.items.find((candidate) => candidate.name === 'paneldynamic');

    expect(item?.title).toBe('Repeating panel');
    expect(item?.category).toBe('Panels');
  });

  test('categories come in a stated order, not alphabetically', () => {
    // A toolbox is read top to bottom and the common answers belong near the top.
    // Alphabetical would open with "Choice" and bury "Text" in the middle.
    expect(toolbox().categories.map((category) => category.name)).toEqual([
      'Text',
      'Choice',
      'Matrix',
      'Panels',
      'Media',
      'Display',
    ]);
  });

  test('a category nobody ordered follows the ones that were', () => {
    const box = toolbox();
    box.add({ type: 'text', name: 'ticket', title: 'Ticket', category: 'Support' });

    expect(box.categories.at(-1)?.name).toBe('Support');
  });
});

describe('parity/K1-toolbox-search', () => {
  test('it matches the title, the type and the keywords', () => {
    const box = toolbox();

    box.setSearch('Repeating');
    expect(matched(box)).toEqual(['paneldynamic']);

    // The type, because somebody who has read the JSON knows `paneldynamic` and not
    // "Repeating panel".
    box.setSearch('paneldynamic');
    expect(matched(box)).toEqual(['paneldynamic']);

    // A keyword, because somebody looking for a dropdown will type "select".
    box.setSearch('select');
    expect(matched(box)).toContain('dropdown');
  });

  test('it ignores case and surrounding space', () => {
    const box = toolbox();
    box.setSearch('  RANKING  ');

    expect(matched(box)).toEqual(['ranking']);
  });

  test('a category with nothing left in it is not drawn', () => {
    const box = toolbox();
    box.setSearch('matrix');

    // A search narrows the toolbox rather than leaving a column of empty headings.
    expect(box.categories.map((category) => category.name)).toEqual(['Matrix']);
  });

  test('a search that finds nothing says so rather than looking broken', () => {
    const box = toolbox();
    box.setSearch('xylophone');

    expect(box.isEmpty).toBe(true);
    expect(box.categories).toEqual([]);
    // The items are still there — a search hides, it does not remove.
    expect(box.items.length).toBeGreaterThan(0);
  });
});

describe('parity/K1-toolbox-custom-items', () => {
  test('one type can appear more than once', () => {
    const box = toolbox();
    box.add({
      name: 'rating-smileys',
      type: 'rating',
      title: 'Smiley rating',
      defaults: { rateType: 'smileys' },
    });

    // Why `name` is the identity rather than `type`: "Rating (stars)" and "Rating
    // (smileys)" create the same type and differ only in what it starts as, and a
    // toolbox keyed by type could not hold both.
    const rating = box.items.filter((item) => item.type === 'rating');
    expect(rating.map((item) => item.name)).toEqual(['rating', 'rating-smileys']);
    expect(rating[1]?.defaults).toEqual({ rateType: 'smileys' });
  });

  test('adding an existing name replaces it', () => {
    const box = toolbox();
    box.add({ type: 'dropdown', title: 'Pick one' });

    // Curation is the same act as addition. Requiring a removal first would make
    // retitling one item a two-step operation nobody would remember.
    expect(box.items.filter((item) => item.name === 'dropdown')).toHaveLength(1);
    expect(box.items.find((item) => item.name === 'dropdown')?.title).toBe('Pick one');
  });

  test('retitling keeps the keywords that were already there', () => {
    const box = toolbox();
    box.add({ type: 'dropdown', title: 'Pick one' });
    box.setSearch('select');

    // Otherwise a host renaming the dropdown silently stops "select" from finding it,
    // and nothing about the change they made suggests it would.
    expect(matched(box)).toContain('dropdown');
  });

  test('an item can be taken away, and taking away nothing is not an error', () => {
    const box = toolbox();
    box.remove('signaturepad');
    box.remove('never-existed');

    expect(names(box)).not.toContain('signaturepad');
  });
});

describe('parity/K1-toolbox-changes', () => {
  test('a change advances the version and announces once', () => {
    const box = toolbox();
    const seen: number[] = [];
    box.onChanged.add((version) => seen.push(version));
    const before = box.version;

    box.setSearch('text');
    box.add({ type: 'text', name: 'note', title: 'Note' });
    box.remove('note');

    expect(seen).toHaveLength(3);
    expect(box.version).toBe(before + 3);
  });

  test('setting the search it already has is not a change', () => {
    const box = toolbox();
    box.setSearch('text');
    const seen: number[] = [];
    box.onChanged.add((version) => seen.push(version));

    box.setSearch('text');

    // A view re-rendering the whole toolbox because a keystroke landed on the same
    // value is a cost paid on every keystroke that changes nothing.
    expect(seen).toEqual([]);
  });
});
