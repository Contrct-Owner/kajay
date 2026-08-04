import { MetadataRegistry, Question, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition, SurveyElement } from '@kajay/core';
import {
  DesignSurface,
  parseEditorText,
} from '@kajay/creator-core';
import { humanizePropertyName } from '../../src/propertyGrid.js';
import { orderPropertyCategories } from '../../src/propertyCategories.js';
import { describe, expect, test } from 'vitest';

/**
 * The property grid — checklist L1.
 *
 * A private registry throughout: the global one is process-wide shared mutable state and
 * these tests register types and properties of their own.
 */
function registry(): MetadataRegistry {
  const created = new MetadataRegistry();
  registerBuiltInTypes(created);
  return created;
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

function surface(
  definition: SurveyDefinition = BASIC,
  created: MetadataRegistry = registry(),
): DesignSurface {
  return new DesignSurface({ definition, registry: created });
}

function selectByName(designed: DesignSurface, name: string): SurveyElement {
  const element = designed.page?.elements.find((candidate) => candidate.name === name);
  if (element === undefined) {
    throw new Error(`No element called "${name}".`);
  }
  designed.select(element);
  return element;
}

function sections(designed: DesignSurface, element: SurveyElement): readonly string[] {
  return designed.properties(element).map((category) => category.name);
}

function rowsIn(
  designed: DesignSurface,
  element: SurveyElement,
  section: string,
): readonly string[] {
  const found = designed.properties(element).find((category) => category.name === section);
  return (found?.rows ?? []).map((row) => row.name);
}

function rowFor(designed: DesignSurface, element: SurveyElement, name: string) {
  return designed
    .properties(element)
    .flatMap((category) => category.rows)
    .find((row) => row.name === name);
}

describe('parity/L1-grid', () => {
  test('the rows are the registry’s, not a list kept here', () => {
    const designed = surface();
    const who = selectByName(designed, 'who');

    // Inherited and own properties alike, in the order the registry declares them —
    // which is the order the element serializes in, so a designer who has read the JSON
    // finds them where they left them.
    expect(rowsIn(designed, who, 'General')).toEqual([
      'name',
      'title',
      'readOnly',
      'inputType',
      'placeholder',
      'min',
      'max',
    ]);
    // `step` is missing on purpose: §L3's condition hides it unless the input type is
    // numeric. Asserted as an exact list precisely so that a property appearing or
    // disappearing is something a test has to be told about.
    // `valueName` and `correctAnswer` are about how the answer is stored and scored
    // rather than how it is asked, so they are one section down.
    expect(rowsIn(designed, who, 'Data')).toEqual(['valueName', 'correctAnswer']);
  });

  test('a custom property on a built-in type appears with nothing added here', () => {
    const created = registry();
    // The `addProperty` seam, which is checklist A5's — and the whole claim of this row:
    // the grid is generated, so an extension nobody told the Creator about is editable.
    created.addProperty('text', { name: 'helpUrl', type: 'string', description: 'Where to read more.' });
    const designed = surface(BASIC, created);

    const row = rowFor(designed, selectByName(designed, 'who'), 'helpUrl');

    expect(row?.title).toBe('Help url');
    expect(row?.editor).toBe('text');
    expect(row?.description).toBe('Where to read more.');
  });

  test('a property added after the survey was parsed still shows its default', () => {
    const created = registry();
    const designed = surface(BASIC, created);

    created.addProperty('text', { name: 'helpUrl', type: 'string', defaultValue: 'https://help' });

    // Defaults are captured on the element when it is *created*, so an element that
    // already existed has never heard of this property. The descriptor is the authority
    // and the row falls back to it — otherwise a host extending a running Creator (§L4)
    // would see an empty field where the registry says there is a value.
    expect(rowFor(designed, selectByName(designed, 'who'), 'helpUrl')?.value).toBe('https://help');
  });

  test('a custom question type brings its own properties', () => {
    const created = registry();
    created.addClass({
      name: 'starnote',
      parent: 'question',
      properties: [{ name: 'starCount', type: 'number', defaultValue: 3 }],
      create: () => new StarNoteQuestion(),
    });
    const designed = surface(
      { pages: [{ name: 'p1', elements: [{ type: 'starnote', name: 'stars' }] }] },
      created,
    );

    const row = rowFor(designed, selectByName(designed, 'stars'), 'starCount');

    expect(row?.editor).toBe('number');
    expect(row?.value).toBe(3);
  });

  test('a page is selectable, so a page has a grid', () => {
    const designed = surface();
    const page = designed.pages[0];
    designed.select(page!);

    // Nothing here knows what a page is. It is a registered class like any other, which
    // is why K4's selectable page needed no property-grid code at all.
    expect(rowsIn(designed, page!, 'General')).toEqual(['name', 'title', 'maxTimeToFinish']);
  });
});

describe('parity/L1-categories', () => {
  test('an expression lands in Logic without being listed anywhere', () => {
    const created = registry();
    created.addProperty('text', { name: 'hideWhen', type: 'string', isExpression: true });
    const designed = surface(BASIC, created);

    // Derived from `isExpression`, which the registry already declares because more than
    // one thing needs to know. A table of expression names here would be wrong the day a
    // property arrived — and a host's own expression property would be in the wrong
    // section with nothing to tell them why.
    expect(rowsIn(designed, selectByName(designed, 'who'), 'Logic')).toContain('hideWhen');
  });

  test('the sections are drawn in a stated order, and empty ones are not drawn', () => {
    const designed = surface();

    expect(sections(designed, selectByName(designed, 'who'))).toEqual([
      'General',
      'Logic',
      'Validation',
      'Layout',
      'Data',
    ]);
  });

  test('a section nobody named is kept, and drawn last', () => {
    // Unreachable through the grid until §L4 lets a host name a section of their own, and
    // reached here directly rather than left as logic nothing has checked.
    expect(orderPropertyCategories(['Data', 'Branding', 'General'])).toEqual([
      'General',
      'Data',
      'Branding',
    ]);
  });

  test('requiredIf is in Logic while isRequired is in Validation', () => {
    const designed = surface();
    const who = selectByName(designed, 'who');

    // The cost of the rule above, stated rather than hidden: the pair is split. Worth it,
    // because "every row in Logic holds an expression" is a claim §M's logic editor can
    // rely on, and "expressions, mostly" is not.
    expect(rowsIn(designed, who, 'Logic')).toContain('requiredIf');
    // `requiredErrorText` is one of §L3's conditional properties and arrives with the
    // requirement it is the message for.
    expect(rowsIn(designed, who, 'Validation')).toEqual(['isRequired']);
    designed.setProperty(who, 'isRequired', true);
    expect(rowsIn(designed, who, 'Validation')).toEqual(['isRequired', 'requiredErrorText']);
  });

  test('the table wins over the derived section', () => {
    const created = registry();
    created.addProperty('text', { name: 'indent', type: 'string', isExpression: true });
    const designed = surface(BASIC, created);

    // `indent` is named as Layout, and a name is a more specific statement than a type.
    // The order these two rules are consulted in is otherwise unobservable, and §L4 is
    // about to let a host add entries — one of which will eventually be an expression.
    expect(rowsIn(designed, selectByName(designed, 'who'), 'Layout')).toContain('indent');
  });

  test('a property nothing has heard of is General, not Other', () => {
    const created = registry();
    created.addProperty('text', { name: 'lozengeColour', type: 'string' });
    const designed = surface(BASIC, created);

    // The opposite of the toolbox's fallback, and deliberately. An unlisted toolbox item
    // is an unknown type among known ones; an unlisted property is usually the one the
    // designer opened the grid to find.
    expect(rowsIn(designed, selectByName(designed, 'who'), 'General')).toContain('lozengeColour');
  });
});

describe('parity/L1-editors', () => {
  test('one editor per declared property type', () => {
    // A numeric input, so `step` — the only number property a text question has — is one
    // §L3 shows.
    const designed = surface({
      pages: [{ name: 'p1', elements: [{ type: 'text', name: 'who', inputType: 'number' }] }],
    });
    const who = selectByName(designed, 'who');
    const kinds = (name: string): string | undefined => rowFor(designed, who, name)?.editor;

    expect(kinds('title')).toBe('text');
    expect(kinds('step')).toBe('number');
    expect(kinds('isRequired')).toBe('boolean');
    expect(kinds('min')).toBe('literal');
    expect(kinds('correctAnswer')).toBe('json');
  });

  test('a literal keeps whichever scalar was typed', () => {
    expect(parseEditorText('literal', 'true')).toBe(true);
    expect(parseEditorText('literal', '42')).toBe(42);
    expect(parseEditorText('literal', '2026-01-01')).toBe('2026-01-01');
  });

  test('a half-typed number is refused rather than rounded to zero', () => {
    // `undefined` means "do not write", not "error". Writing 0 the instant a field is
    // cleared is how a number editor becomes impossible to clear.
    expect(parseEditorText('number', '')).toBeUndefined();
    expect(parseEditorText('number', '-')).toBeUndefined();
    expect(parseEditorText('number', '12')).toBe(12);
  });

  test('unparseable JSON is refused and an empty field clears the property', () => {
    expect(parseEditorText('json', '{"a":')).toBeUndefined();
    expect(parseEditorText('json', '{"a":1}')).toEqual({ a: 1 });
    // The registered default for a `json` property. Refusing the empty field instead
    // would make a correctAnswer impossible to take back off a question.
    expect(parseEditorText('json', '  ')).toBe('');
  });

  test('a boolean is not typed into', () => {
    expect(parseEditorText('boolean', 'true')).toBeUndefined();
  });
});

describe('parity/L1-labels', () => {
  test('the label is derived from the name, and an acronym survives', () => {
    expect(humanizePropertyName('startWithNewLine')).toBe('Start with new line');
    expect(humanizePropertyName('visibleIf')).toBe('Visible if');
    expect(humanizePropertyName('showTOC')).toBe('Show TOC');
    expect(humanizePropertyName('name')).toBe('Name');
  });
});

class StarNoteQuestion extends Question {
  override get type(): string {
    return 'starnote';
  }
}
