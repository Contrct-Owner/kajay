import { MetadataRegistry, Question, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition, SurveyElement } from '@kajay/core';
import { childLabel, childrenIn, DesignSurface, withChildren } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

/** Child collections: the choices editor and the validators editor — checklist L2. */
const BASIC: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        {
          type: 'radiogroup',
          name: 'tier',
          title: 'Which tier?',
          choices: ['bronze', { value: 'silver', text: 'Silver' }],
        },
        { type: 'text', name: 'who' },
        {
          type: 'matrixdynamic',
          name: 'grid',
          columns: [{ type: 'dropdown', name: 'size', choices: ['s', 'm'] }],
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

function surface(definition: SurveyDefinition = BASIC): DesignSurface {
  return new DesignSurface({ definition, registry: registry() });
}

function elementNamed(designed: DesignSurface, name: string): SurveyElement {
  const found = designed.survey.getQuestionByName(name);
  if (found === undefined) {
    throw new Error(`No question called "${name}".`);
  }
  designed.select(found);
  return found;
}

function collection(designed: DesignSurface, owner: string, property: string) {
  return designed.collections(elementNamed(designed, owner)).find((row) => row.property === property);
}

function valuesOf(designed: DesignSurface, owner: string, property: string): readonly unknown[] {
  return (childrenIn(designed.definition, owner, property) ?? []).map(
    (child) => child['value'] ?? child,
  );
}

describe('parity/L2-collections', () => {
  test('the collections are the registry’s, and `elements` is not among them', () => {
    const designed = surface();

    expect(designed.collections(elementNamed(designed, 'tier')).map((row) => row.property)).toEqual([
      'validators',
      'choices',
    ]);
    // What a page holds is the canvas's: K2 and K3 built dragging, dropping, selecting
    // and adorning for exactly that collection, and a second way to reorder it here would
    // be a second place for the two to disagree.
    const page = designed.pages[0]!;
    expect(designed.collections(page).map((row) => row.property)).toEqual([]);
  });

  test('what a collection offers is read off the registry, not off its name', () => {
    const designed = surface();

    // A choice is always an `itemvalue`, so there is one type and no picker. A validator
    // has seven concrete subclasses, so it needs one.
    expect(collection(designed, 'tier', 'choices')?.types).toEqual(['itemvalue']);
    expect(collection(designed, 'tier', 'validators')?.types.length).toBeGreaterThan(1);

    // The shorthand is what says a child has a scalar form a line of text can carry.
    expect(collection(designed, 'tier', 'choices')?.shorthand).toBe('value');
    expect(collection(designed, 'tier', 'validators')?.shorthand).toBeUndefined();
  });

  test('a collection with nothing constructable in it offers nothing', () => {
    const created = registry();
    created.addClass({ name: 'nothingyet', isAbstract: true });
    created.addClass({
      name: 'holder',
      parent: 'text',
      childCollections: [{ property: 'extras', elementBaseType: 'nothingyet' }],
      create: () => new HolderQuestion(),
    });
    const designed = new DesignSurface({
      definition: { pages: [{ name: 'p1', elements: [{ type: 'holder', name: 'box' }] }] },
      registry: created,
    });
    const box = designed.page?.elements[0]!;

    // No fallback to the base type: it is abstract, so offering it would produce a child
    // the registry refuses to create. A view with no types to offer draws no Add control.
    expect(designed.collections(box).find((row) => row.property === 'extras')?.types).toEqual([]);
  });

  test('a child is labelled by what it is called, what it stands for, or what it is', () => {
    const designed = surface({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'who', validators: [{ type: 'emailvalidator' }] },
            { type: 'radiogroup', name: 'tier', choices: ['bronze'] },
            { type: 'matrixdynamic', name: 'grid', columns: [{ type: 'text', name: 'size' }] },
          ],
        },
      ],
    });

    expect(childLabel(collection(designed, 'who', 'validators')!.children[0]!)).toBe(
      'emailvalidator',
    );
    expect(childLabel(collection(designed, 'tier', 'choices')!.children[0]!)).toBe('bronze');
    expect(childLabel(collection(designed, 'grid', 'columns')!.children[0]!)).toBe('size');
  });

  test('the children are the model’s own, so L1’s grid edits them', () => {
    const designed = surface();
    const choice = collection(designed, 'tier', 'choices')!.children[1]!;

    designed.setProperty(choice, 'text', 'Silver tier');

    // A choice's `text` is a registered localizable string, so it goes through exactly the
    // path a question's title goes through — no editor of its own.
    expect(valuesOf(designed, 'tier', 'choices')).toEqual(['bronze', 'silver']);
    expect(childrenIn(designed.definition, 'tier', 'choices')?.[1]?.['text']).toBe('Silver tier');
  });
});

describe('parity/L2-collection-edits', () => {
  test('adding a choice gives it a value nothing in the list has taken', () => {
    const designed = surface();

    expect(designed.addChild(elementNamed(designed, 'tier'), 'choices', 'itemvalue')).toBe(true);

    // Stemmed on the property the registry says the shorthand fills, and counted within
    // the list — a choice's value is unique in its list and means nothing outside it.
    expect(valuesOf(designed, 'tier', 'choices')).toEqual(['bronze', 'silver', 'value1']);

    designed.addChild(elementNamed(designed, 'tier'), 'choices', 'itemvalue');
    expect(valuesOf(designed, 'tier', 'choices')).toEqual([
      'bronze',
      'silver',
      'value1',
      'value2',
    ]);
  });

  test('only the elements on the path are rebuilt', () => {
    const designed = surface();
    const before = designed.definition;

    designed.addChild(elementNamed(designed, 'tier'), 'choices', 'itemvalue');

    // The question beside the one being edited is shared rather than cloned: editing a
    // choice list should not rebuild the survey around it, the sharing K2 established for
    // the canvas generalized to any element with a name. Compared through `withChildren`,
    // because `definition` re-serializes and shares nothing by construction.
    const page = (before['pages'] as readonly SurveyDefinition[])[0]!;
    const elements = page['elements'] as readonly SurveyDefinition[];
    const after = withChildren(before, 'tier', 'choices', []);
    const afterPage = (after['pages'] as readonly SurveyDefinition[])[0]!;
    expect((afterPage['elements'] as readonly SurveyDefinition[])[1]).toBe(elements[1]);
  });

  test('adding a column gives it a name nothing in the survey has taken', () => {
    const designed = surface();

    designed.addChild(elementNamed(designed, 'grid'), 'columns', 'text');

    // Stemmed on the type, from the survey-wide pool — `text1`, exactly what the toolbox
    // produces, because a column that is a text question is the same kind of thing
    // arriving by a different door.
    expect(childrenIn(designed.definition, 'grid', 'columns')?.map((child) => child['name'])).toEqual([
      'size',
      'text1',
    ]);
  });

  test('a validator is added as the type that was picked', () => {
    const designed = surface();

    designed.addChild(elementNamed(designed, 'who'), 'validators', 'numericvalidator');

    // It reaches the *model* rather than only the definition, which is the whole reason
    // this is a structural edit: a validator is a rule the parser registers, and one
    // pushed into the model's array would serialize correctly and never run.
    expect(designed.survey.getQuestionByName('who')?.getChildren('validators')).toHaveLength(1);
    expect(childrenIn(designed.definition, 'who', 'validators')?.[0]?.['type']).toBe(
      'numericvalidator',
    );
  });

  test('removing and reordering, and both undoable without a line about undo', () => {
    const designed = surface();
    const tier = elementNamed(designed, 'tier');

    designed.moveChild(tier, 'choices', 0, 1);
    expect(valuesOf(designed, 'tier', 'choices')).toEqual(['silver', 'bronze']);
    // The selection survives the re-parse, because editing a question's choices is
    // working on that question — moving the grid off it would take away the panel being
    // typed in. Asserted here rather than after an undo, which restores the selection
    // from its own snapshot and would pass either way.
    expect(designed.selectedName).toBe('tier');
    expect(designed.selected).not.toBe(tier);

    designed.removeChild(designed.selected!, 'choices', 0);
    expect(valuesOf(designed, 'tier', 'choices')).toEqual(['bronze']);

    designed.undo();
    designed.undo();
    expect(valuesOf(designed, 'tier', 'choices')).toEqual(['bronze', 'silver']);
  });

  test('a collection three levels down is found by name alone', () => {
    const designed = surface();
    const column = designed.survey
      .getQuestionByName('grid')
      ?.getChildren('columns')[0] as SurveyElement;

    designed.addChild(column, 'choices', 'itemvalue');

    // Names are unique across a survey, which is what makes one deep walk enough to reach
    // a choice list on a matrix column rather than a second traversal per container.
    expect(valuesOf(designed, 'size', 'choices')).toEqual(['s', 'm', 'value1']);
  });

  test('a move that changes nothing is refused rather than recorded', () => {
    const designed = surface();
    const tier = elementNamed(designed, 'tier');

    expect(designed.moveChild(tier, 'choices', 0, 0)).toBe(false);
    expect(designed.moveChild(tier, 'choices', 0, 9)).toBe(false);
    // An entry that undoes nothing is worse than no entry: pressing undo then appears to
    // do nothing at all.
    expect(designed.canUndo).toBe(false);
  });

  test('a collection the type does not declare is refused', () => {
    const designed = surface();
    const who = elementNamed(designed, 'who');

    // A text question has no choices. Writing them anyway would put a key on it that the
    // type does not have — an unknown property that round-trips forever and edits nothing.
    expect(designed.removeChild(who, 'choices', 0)).toBe(false);
    expect(designed.moveChild(who, 'choices', 0, 1)).toBe(false);
    expect(designed.addChild(who, 'choices', 'itemvalue')).toBe(false);
  });
});

class HolderQuestion extends Question {
  override get type(): string {
    return 'holder';
  }
}
