import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition, SurveyElement } from '@kajay/core';
import { DesignSurface } from '@kajay/creator-core';
import type { PropertyGridOptions } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

/** The property-grid customization API — checklist L4. */
function registry(): MetadataRegistry {
  const created = new MetadataRegistry();
  registerBuiltInTypes(created);
  return created;
}

const BASIC: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [{ type: 'radiogroup', name: 'tier', title: 'Tier', choices: ['bronze'] }],
    },
  ],
};

function surface(created: MetadataRegistry = registry()): DesignSurface {
  const designed = new DesignSurface({ definition: BASIC, registry: created });
  const tier = designed.survey.getQuestionByName('tier');
  if (tier !== undefined) {
    designed.select(tier);
  }
  return designed;
}

function selected(designed: DesignSurface): SurveyElement {
  const element = designed.selected;
  if (element === undefined) {
    throw new Error('Nothing selected.');
  }
  return element;
}

function rowsIn(
  designed: DesignSurface,
  section: string,
  grid?: PropertyGridOptions,
): readonly string[] {
  const found = designed
    .properties(selected(designed), grid)
    .find((category) => category.name === section);
  return (found?.rows ?? []).map((row) => row.name);
}

function sections(designed: DesignSurface, grid?: PropertyGridOptions): readonly string[] {
  return designed.properties(selected(designed), grid).map((category) => category.name);
}

describe('parity/L4-customization', () => {
  test('a hidden property is not offered at all', () => {
    const designed = surface();

    expect(rowsIn(designed, 'Data')).toContain('valueName');
    expect(rowsIn(designed, 'Data', { hidden: ['valueName'] })).not.toContain('valueName');
  });

  test('hiding every member of a section removes the heading with it', () => {
    const designed = surface();

    // There is deliberately no separate way to hide a section: an empty one is already
    // not drawn, so this falls out of L1 rather than being a second mechanism.
    expect(sections(designed)).toContain('Data');
    expect(sections(designed, { hidden: ['valueName', 'correctAnswer'] })).not.toContain('Data');
  });

  test('a collection is hidden by the same list', () => {
    const designed = surface();
    const properties = (grid?: PropertyGridOptions): readonly string[] =>
      designed.collections(selected(designed), grid).map((row) => row.property);

    // To a host, "do not show the validators editor" and "do not show `valueName`" are
    // one kind of decision.
    expect(properties()).toContain('validators');
    expect(properties({ hidden: ['validators'] })).not.toContain('validators');
  });

  test('a label a host prefers wins over the derived one', () => {
    const designed = surface();
    const title = (grid?: PropertyGridOptions): string | undefined =>
      designed
        .properties(selected(designed), grid)
        .flatMap((category) => category.rows)
        .find((row) => row.name === 'colCount')?.title;

    // L1 derives labels rather than tabling them, and named "Col count" as the case a
    // host would fix. This is where.
    expect(title()).toBe('Col count');
    expect(title({ titles: { colCount: 'Columns' } })).toBe('Columns');
  });

  test('a collection’s label can be replaced too', () => {
    const designed = surface();

    expect(
      designed
        .collections(selected(designed), { titles: { choices: 'Answer options' } })
        .find((row) => row.property === 'choices')?.title,
    ).toBe('Answer options');
  });

  test('a section a host names is kept, and drawn where they asked', () => {
    const designed = surface();

    const grid: PropertyGridOptions = {
      categories: { correctAnswer: 'Quiz' },
      categoryOrder: ['Quiz', 'General'],
    };

    // A section the library has never heard of. Ordering a host states replaces ours
    // outright, and sections they did not name still follow — so naming one does not
    // hide the rest.
    expect(rowsIn(designed, 'Quiz', grid)).toEqual(['correctAnswer']);
    expect(sections(designed, grid).slice(0, 2)).toEqual(['Quiz', 'General']);
    expect(sections(designed, grid)).toContain('Logic');
  });

  test('named properties come first within their own section', () => {
    const designed = surface();

    expect(rowsIn(designed, 'General').slice(0, 2)).toEqual(['name', 'title']);

    // Anything not named keeps the registry's order behind those that are — which is
    // serialization order, the thing L1 chose on purpose.
    const reordered = rowsIn(designed, 'General', { order: ['title', 'name'] });
    expect(reordered.slice(0, 2)).toEqual(['title', 'name']);
    expect(reordered.slice(2)).toEqual(rowsIn(designed, 'General').slice(2));
  });

  test('a property in another section is not dragged out of it by the order', () => {
    const designed = surface();

    // `isRequired` is in Validation, so naming it here orders it *there* — one list, and
    // it means "first in whichever section you are in".
    const grid: PropertyGridOptions = { order: ['isRequired', 'title'] };
    expect(rowsIn(designed, 'Validation', grid)[0]).toBe('isRequired');
    expect(rowsIn(designed, 'General', grid)[0]).toBe('title');
  });

  test('everything unmentioned is exactly as the registry left it', () => {
    const designed = surface();

    // The whole shape of this API: a refinement of what the registry said, never a
    // replacement for it. A host who wants one thing different says one thing.
    expect(sections(designed, { hidden: ['valueName'] })).toEqual(sections(designed));
    expect(rowsIn(designed, 'Logic', { titles: { colCount: 'Columns' } })).toEqual(
      rowsIn(designed, 'Logic'),
    );
  });

  test('a custom property is customizable like any other', () => {
    const created = registry();
    created.addProperty('radiogroup', { name: 'helpUrl', type: 'string' });
    const designed = surface(created);

    // Half of this row was already true and tested (§L1): a custom property appears with
    // nothing added to the Creator. This is the other half — it is not a second-class
    // citizen of the grid it appears in.
    expect(rowsIn(designed, 'Guidance', { categories: { helpUrl: 'Guidance' } })).toEqual([
      'helpUrl',
    ]);
    expect(rowsIn(designed, 'General', { hidden: ['helpUrl'] })).not.toContain('helpUrl');
  });
});
