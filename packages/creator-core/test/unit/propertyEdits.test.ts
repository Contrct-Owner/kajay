import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { PropertyValue, SurveyDefinition, SurveyElement } from '@kajay/core';
import { DesignSurface } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

/**
 * Writing a property, and renaming an element — checklist L1.
 *
 * Split from `propertyGrid.test.ts`, which is about what the grid *reads*. These are
 * about what it writes, and the two halves have different failure modes: a wrong section
 * is visible the moment somebody looks, where a rename that leaves a reference behind
 * looks entirely correct.
 */
function surface(definition: SurveyDefinition = BASIC): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition, registry });
}

const BASIC: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'who', title: 'Your name' },
        { type: 'comment', name: 'why', title: 'Why?', visibleIf: '{who} notempty' },
      ],
    },
  ],
};

function selectByName(designed: DesignSurface, name: string): SurveyElement {
  const element = designed.page?.elements.find((candidate) => candidate.name === name);
  if (element === undefined) {
    throw new Error(`No element called "${name}".`);
  }
  designed.select(element);
  return element;
}

function rowFor(designed: DesignSurface, element: SurveyElement, name: string) {
  return designed
    .properties(element)
    .flatMap((category) => category.rows)
    .find((row) => row.name === name);
}

function elementIn(definition: SurveyDefinition, name: string): Record<string, PropertyValue> {
  const pages = definition['pages'] as readonly SurveyDefinition[];
  const elements = pages[0]!['elements'] as readonly SurveyDefinition[];
  return (elements.find((element) => element['name'] === name) ?? {}) as Record<
    string,
    PropertyValue
  >;
}

describe('parity/L1-set', () => {
  test('a property is written and shows up in the definition', () => {
    const designed = surface();
    const who = selectByName(designed, 'who');

    expect(designed.setProperty(who, 'isRequired', true)).toBe(true);

    expect(elementIn(designed.definition, 'who')['isRequired']).toBe(true);
  });

  test('a localized title is edited in place, not replaced', () => {
    const designed = surface({
      locale: 'fr',
      pages: [
        {
          name: 'p1',
          elements: [{ type: 'text', name: 'who', title: { default: 'Name', fr: 'Nom' } }],
        },
      ],
    });
    const who = selectByName(designed, 'who');

    designed.setProperty(who, 'title', 'Nom complet');

    // Overwriting with a plain string would drop every other language the moment
    // somebody fixed a typo, and nothing about typing in a box suggests that.
    expect(elementIn(designed.definition, 'who')['title']).toEqual({
      default: 'Name',
      fr: 'Nom complet',
    });
  });

  test('a plain string stays a plain string', () => {
    const designed = surface();
    const who = selectByName(designed, 'who');

    designed.setProperty(who, 'title', 'Your full name');

    expect(elementIn(designed.definition, 'who')['title']).toBe('Your full name');
  });

  test('the grid shows a localized value in the survey’s own language', () => {
    const designed = surface({
      locale: 'fr',
      pages: [
        {
          name: 'p1',
          elements: [{ type: 'text', name: 'who', title: { default: 'Name', fr: 'Nom' } }],
        },
      ],
    });

    expect(rowFor(designed, selectByName(designed, 'who'), 'title')?.text).toBe('Nom');
  });

  test('only a localizable property is merged into', () => {
    const designed = surface({
      pages: [
        {
          name: 'p1',
          elements: [{ type: 'text', name: 'who', correctAnswer: { default: 'Ada' } }],
        },
      ],
    });
    const who = selectByName(designed, 'who');

    designed.setProperty(who, 'correctAnswer', 'Grace');

    // `correctAnswer` is a `json` property, so an authored `{ default: … }` is data
    // rather than a translation. Merging into it because it happens to look like
    // localized text would keep an answer nobody can see and nobody can remove.
    expect(elementIn(designed.definition, 'who')['correctAnswer']).toBe('Grace');
  });

  test('a property the type does not declare is refused', () => {
    const designed = surface();

    // The grid only ever offers declared properties, so anything else arriving here is a
    // caller that got the element and the property from two different places — and the
    // value would round-trip as an unknown property and never be seen again.
    expect(designed.setProperty(selectByName(designed, 'who'), 'nonsense', 1)).toBe(false);
  });

  test('every keystroke of one field is one undo entry', () => {
    const designed = surface();
    const who = selectByName(designed, 'who');

    designed.setProperty(who, 'title', 'Y');
    designed.setProperty(who, 'title', 'Yo');
    designed.setProperty(who, 'title', 'You');
    designed.undo();

    // K6's coalescing, keyed on the element and the property. Giving a rename back one
    // letter at a time is not what anybody means by undoing it.
    expect(elementIn(designed.definition, 'who')['title']).toBe('Your name');
  });

  test('moving to another property ends the run', () => {
    const designed = surface();
    const who = selectByName(designed, 'who');

    designed.setProperty(who, 'title', 'Renamed');
    designed.setProperty(who, 'placeholder', 'Type here');
    designed.undo();

    // Keying on the element alone would give a designer back the title and the
    // placeholder together, which is not what either of them means by undoing.
    expect(elementIn(designed.definition, 'who')['title']).toBe('Renamed');
    expect(elementIn(designed.definition, 'who')['placeholder']).toBeUndefined();
  });
});

describe('parity/L1-rename', () => {
  test('every reference follows the name', () => {
    const designed = surface();

    expect(designed.rename('who', 'applicant')).toBe(true);

    // A rename that changed only the `name` key would leave `visibleIf` pointing at a
    // question that no longer exists: the survey would still parse, still render, and
    // simply stop working. K5 already argued that is worse than failing loudly.
    expect(elementIn(designed.definition, 'why')['visibleIf']).toBe('{applicant} notempty');
    expect(designed.selected?.getPropertyValue('name')).toBe('applicant');
  });

  test('a name already spoken for is refused', () => {
    const designed = surface();

    expect(designed.rename('who', 'why')).toBe(false);
    expect(designed.setProperty(selectByName(designed, 'who'), 'name', 'why')).toBe(false);
    expect(elementIn(designed.definition, 'who')['name']).toBe('who');
  });

  test('a blank name is refused', () => {
    const designed = surface();

    expect(designed.rename('who', '   ')).toBe(false);
    expect(elementIn(designed.definition, 'who')['name']).toBe('who');
  });

  test('renaming the page being looked at does not navigate away from it', () => {
    const designed = surface({
      pages: [
        { name: 'p1', elements: [{ type: 'text', name: 'who' }] },
        { name: 'p2', elements: [{ type: 'text', name: 'why' }] },
      ],
    });
    designed.goToPage('p2');

    expect(designed.rename('p2', 'details')).toBe(true);

    // `applyEdit` otherwise restores "the page called p2", which is the one thing that
    // cannot work when p2 is what just changed — and a failed `goTo` leaves a fresh parse
    // on page one, so this is only observable from a page that is not the first.
    expect(designed.page?.name).toBe('details');
  });

  test('a rename is undoable, references and all', () => {
    const designed = surface();

    designed.rename('who', 'applicant');
    designed.undo();

    expect(elementIn(designed.definition, 'who')['name']).toBe('who');
    expect(elementIn(designed.definition, 'why')['visibleIf']).toBe('{who} notempty');
  });
});
