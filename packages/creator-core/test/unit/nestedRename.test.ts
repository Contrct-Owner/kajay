import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface } from '@kajay/creator-core';
import { findNamed } from '../../src/definitionWalk.js';
import { freshenFragment } from '../../src/fragments.js';
import { describe, expect, test } from 'vitest';

/**
 * A rename carried into `{owner.child}` as well as `{child}` — checklist K5, L1.
 *
 * The rewrite followed a *root* name only, so every nested rename left references behind:
 * a survey that still parses, still renders and quietly stops working. Each test here is
 * an expression that used to be left pointing at a name nothing answers to.
 */
function registry(): MetadataRegistry {
  const created = new MetadataRegistry();
  registerBuiltInTypes(created);
  return created;
}

function surface(definition: SurveyDefinition): DesignSurface {
  return new DesignSurface({ definition, registry: registry() });
}

/** One element out of the designer's own JSON, wherever in the tree it sits. */
function elementNamed(designed: DesignSurface, name: string): SurveyDefinition {
  const element = findNamed(designed.definition, name);
  if (element === undefined) {
    throw new Error(`No element called "${name}".`);
  }
  return element;
}

describe('parity/L1-nested-rename', () => {
  test('a blank rename carries the expression that reads it', () => {
    const designed = surface({
      pages: [
        {
          name: 'p1',
          elements: [
            {
              type: 'fillintheblank',
              name: 'plan',
              template: 'We need [[seats]] seats.',
              blanks: [{ type: 'text', name: 'seats' }],
            },
            { type: 'expression', name: 'total', expression: '{plan.seats} * 120' },
          ],
        },
      ],
    });

    expect(designed.rename('seats', 'people')).toBeUndefined();

    // The answer really does live at `plan.people` now. Before this, the sentence was
    // renamed and the total went on reading a blank that no longer existed.
    expect(elementNamed(designed, 'total')['expression']).toBe('{plan.people} * 120');
  });

  test('a matrix column rename carries both ways of naming it', () => {
    const designed = surface({
      pages: [
        {
          name: 'p1',
          elements: [
            {
              type: 'matrixdynamic',
              name: 'grid',
              columns: [
                { type: 'text', name: 'size' },
                { type: 'text', name: 'note', visibleIf: "{row.size} = 'l'" },
              ],
            },
            { type: 'text', name: 'summary', title: 'First size: {grid[0].size}' },
          ],
        },
      ],
    });

    expect(designed.rename('size', 'width')).toBeUndefined();

    // Two syntaxes for one column: by row index from outside, and by the row's own word
    // from inside. `row` is the model's constant, declared on the type as `recordScope`,
    // so the Creator reads the language's word rather than keeping a copy of it.
    expect(elementNamed(designed, 'summary')['title']).toBe('First size: {grid[0].width}');
    expect(elementNamed(designed, 'note')['visibleIf']).toBe("{row.width} = 'l'");
  });

  test('a rename inside a repeating panel follows the panel’s own word', () => {
    const designed = surface({
      pages: [
        {
          name: 'p1',
          elements: [
            {
              type: 'paneldynamic',
              name: 'people',
              templateElements: [
                { type: 'text', name: 'who' },
                { type: 'text', name: 'role', visibleIf: "{panel.who} = 'me'" },
              ],
            },
          ],
        },
      ],
    });

    expect(designed.rename('who', 'person')).toBeUndefined();

    expect(elementNamed(designed, 'role')['visibleIf']).toBe("{panel.person} = 'me'");
  });

  test('a record word reaches its own children and nothing else', () => {
    const designed = surface({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'matrixdynamic', name: 'grid', columns: [{ type: 'text', name: 'size' }] },
            { type: 'text', name: 'elsewhere', visibleIf: "{row.size} = 'l'" },
          ],
        },
      ],
    });

    expect(designed.rename('size', 'width')).toBeUndefined();

    // `{row.size}` on a question that is in no matrix is not a reference to somebody
    // else's column — it resolves to nothing, and a rename must not invent a meaning
    // for it.
    expect(elementNamed(designed, 'elsewhere')['visibleIf']).toBe("{row.size} = 'l'");
  });

  test('a key that is not a child of the owner is left alone', () => {
    const designed = surface({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'matrixdynamic', name: 'grid', columns: [{ type: 'text', name: 'tier' }] },
            { type: 'text', name: 'greeting', title: 'Hello {$profile.tier}, {other.tier}' },
          ],
        },
      ],
    });

    expect(designed.rename('tier', 'level')).toBeUndefined();

    // The reason the rewrite is qualified rather than textual: a host value and an
    // unrelated question can both hold a key called `tier`, and rewriting every `.tier`
    // in every expression would break two references to fix one.
    expect(elementNamed(designed, 'greeting')['title']).toBe('Hello {$profile.tier}, {other.tier}');
  });

  test('a pasted copy’s nested references follow the copy', () => {
    const { fragment } = freshenFragment(
      {
        type: 'matrixdynamic',
        name: 'grid',
        columns: [
          { type: 'text', name: 'size' },
          { type: 'text', name: 'note', visibleIf: "{row.size} = 'l'" },
        ],
      },
      new Set(['grid', 'size', 'note']),
      registry(),
    );

    // The same hole in the paste path, and the sharper one: duplicating a matrix renames
    // its columns, so `{row.size}` in the copy meant a column that had just been renamed
    // out from under it. Both names moved, so the reference has to move with them.
    const columns = fragment['columns'] as readonly SurveyDefinition[];
    expect(columns[0]?.['name']).toBe('size2');
    expect(columns[1]?.['visibleIf']).toBe("{row.size2} = 'l'");
  });

  test('a matrix inside a repeating panel is reached at any depth', () => {
    const designed = surface({
      pages: [
        {
          name: 'p1',
          elements: [
            {
              type: 'paneldynamic',
              name: 'people',
              templateElements: [
                { type: 'matrixdynamic', name: 'grid', columns: [{ type: 'text', name: 'size' }] },
              ],
            },
            { type: 'text', name: 'summary', title: '{people[0].grid[0].size}' },
          ],
        },
      ],
    });

    expect(designed.rename('size', 'width')).toBeUndefined();

    // The owner is named mid-path here rather than straight after the brace, which is
    // why the tail is matched after a `{` *or* a `.`.
    expect(elementNamed(designed, 'summary')['title']).toBe('{people[0].grid[0].width}');
  });
});
