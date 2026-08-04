import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface, Toolbox, allowedToolboxItems, isTypeAllowed } from '@kajay/creator-core';
import type { CreatorConfiguration, ToolboxItem } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

/** Configuration — checklist N2. Everything here can only take something away. */
const BASIC: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'who', title: 'Your name' },
        { type: 'radiogroup', name: 'tier', choices: ['a'] },
      ],
    },
  ],
};

function registry(): MetadataRegistry {
  const made = new MetadataRegistry();
  registerBuiltInTypes(made);
  return made;
}

function surface(configuration?: CreatorConfiguration): DesignSurface {
  return new DesignSurface({ definition: BASIC, registry: registry(), configuration });
}

function toolboxTypes(configuration?: CreatorConfiguration): readonly string[] {
  return new Toolbox({ registry: registry(), configuration }).items.map((item) => item.type);
}

const NEW_TEXT = {
  kind: 'new' as const,
  item: { name: 'text', type: 'text', title: 'Text', category: 'x', keywords: [], defaults: {} },
};

const NEW_FILE = {
  kind: 'new' as const,
  item: { name: 'file', type: 'file', title: 'File', category: 'x', keywords: [], defaults: {} },
};

describe('parity/N2-types', () => {
  test('no configuration is the most capable Creator', () => {
    // Every field can only take something away, which is what keeps the shape checkable.
    expect(toolboxTypes()).toContain('file');
    expect(toolboxTypes().length).toBeGreaterThan(5);
  });

  test('an allow-list restricts the toolbox to what it names', () => {
    expect(toolboxTypes({ allowedTypes: ['text', 'radiogroup'] })).toEqual([
      'radiogroup',
      'text',
    ]);
  });

  test('an empty allow-list means none, not unrestricted', () => {
    // A deployment offering a fixed set of pre-built pages is a real thing, and "empty
    // means unrestricted" is the sort of rule that deletes somebody's restriction.
    expect(toolboxTypes({ allowedTypes: [] })).toEqual([]);
  });

  test('a block-list applies after the allow-list', () => {
    expect(toolboxTypes({ allowedTypes: ['text', 'file'], blockedTypes: ['file'] })).toEqual([
      'text',
    ]);
  });

  test('the toolbox order is the registry’s, not the allow-list’s', () => {
    // Otherwise a configuration would silently do two things at once.
    expect(toolboxTypes({ allowedTypes: ['text', 'boolean'] })).toEqual(
      toolboxTypes({ allowedTypes: ['boolean', 'text'] }),
    );
  });

  test('a host’s own item is held to the same restriction', () => {
    const toolbox = new Toolbox({ registry: registry(), configuration: { blockedTypes: ['file'] } });

    toolbox.add({ type: 'file', name: 'sneaky-file' });

    // A curation seam that let a blocked type back in through the side door would be worse
    // than no restriction at all.
    expect(toolbox.items.map((item) => item.type)).not.toContain('file');
  });

  test('a restricted type cannot be placed, even by a caller that asks directly', () => {
    const designed = surface({ allowedTypes: ['text'] });
    const slot = { list: { of: 'elements' as const, container: 'p1' }, index: 0 };

    expect(designed.place(NEW_FILE, slot)).toBe(false);
    expect(designed.place(NEW_TEXT, slot)).toBe(true);
  });

  test('a restricted type cannot be converted into either', () => {
    const designed = surface({ blockedTypes: ['comment'] });

    expect(designed.convert('who', 'comment')).toBe(false);
    expect(designed.convertibleTypes).not.toContain('comment');
    // A type a designer may not add is one they may not convert into: otherwise the
    // restriction is a detour rather than a rule.
    expect(designed.convert('who', 'boolean')).toBe(true);
  });

  test('moving an element that already exists is not adding a type', () => {
    const designed = surface({ allowedTypes: [] });

    // The restriction is about what a designer may *add*. A survey that already contains a
    // radiogroup is still one a restricted designer can rearrange.
    expect(
      designed.place(
        { kind: 'move', name: 'tier' },
        { list: { of: 'elements', container: 'p1' }, index: 0 },
      ),
    ).toBe(true);
  });

  test('the two helpers agree with each other', () => {
    const configuration: CreatorConfiguration = { allowedTypes: ['text'], blockedTypes: ['file'] };
    const items: readonly ToolboxItem[] = [
      { name: 'text', type: 'text', title: 'Text', category: 'x', keywords: [], defaults: {} },
      { name: 'file', type: 'file', title: 'File', category: 'x', keywords: [], defaults: {} },
    ];

    expect(allowedToolboxItems(items, configuration).map((item) => item.type)).toEqual(['text']);
    expect(isTypeAllowed('text', configuration)).toBe(true);
    expect(isTypeAllowed('file', configuration)).toBe(false);
    expect(isTypeAllowed('anything')).toBe(true);
  });
});

describe('parity/N2-read-only', () => {
  test('a read-only Creator refuses every structural edit', () => {
    const designed = surface({ isReadOnly: true });
    const before = JSON.stringify(designed.definition);

    designed.place(NEW_TEXT, { list: { of: 'elements', container: 'p1' }, index: 0 });
    designed.removeElement('who');
    designed.duplicate('who');
    designed.addPage();

    expect(JSON.stringify(designed.definition)).toBe(before);
  });

  test('a read-only Creator refuses every property edit', () => {
    const designed = surface({ isReadOnly: true });
    const who = designed.survey.getQuestionByName('who');

    designed.setProperty(who!, 'title', 'Renamed');

    // The two chokepoints K6 established are the two a restriction has to hold: between
    // them nothing reaches the survey, so this is enforced once rather than per button.
    expect(who?.getPropertyValue('title')).toBe('Your name');
    expect(designed.canUndo).toBe(false);
  });

  test('a read-only Creator is a viewer, not a hidden one', () => {
    const designed = surface({ isReadOnly: true });

    // A reviewer needs to see the logic to comment on it, so everything is still readable.
    expect(designed.isReadOnly).toBe(true);
    expect(designed.survey.getQuestionByName('who')?.title).toBe('Your name');
    expect(designed.properties(designed.survey.getQuestionByName('who')!).length).toBeGreaterThan(0);
  });

  test('selecting is not editing, so it still works', () => {
    const designed = surface({ isReadOnly: true });
    const who = designed.survey.getQuestionByName('who');

    designed.select(who!);

    expect(designed.selected).toBe(who);
  });

  test('no configuration means nothing is read-only', () => {
    expect(surface().isReadOnly).toBe(false);
    expect(surface({}).isReadOnly).toBe(false);
  });
});
