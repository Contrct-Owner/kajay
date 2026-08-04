import { ExpressionCache, MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition, SurveyElement } from '@kajay/core';
import { conditionOutcome, DesignSurface, propertyScopeOf } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

/** Property visibility and read-only rules — checklist L3. */
function registry(): MetadataRegistry {
  const created = new MetadataRegistry();
  registerBuiltInTypes(created);
  return created;
}

function surface(
  definition: SurveyDefinition,
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

function names(designed: DesignSurface, element: SurveyElement): readonly string[] {
  return designed.properties(element).flatMap((category) => category.rows.map((row) => row.name));
}

function rowFor(designed: DesignSurface, element: SurveyElement, name: string) {
  return designed
    .properties(element)
    .flatMap((category) => category.rows)
    .find((row) => row.name === name);
}

const TIER: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [{ type: 'radiogroup', name: 'tier', choices: ['bronze'] }],
    },
  ],
};

describe('parity/L3-visibility', () => {
  test('a property that means nothing in this shape is not offered', () => {
    const designed = surface(TIER);
    const tier = selectByName(designed, 'tier');

    // A field that does nothing is worse than no field, because a designer fills it in.
    expect(names(designed, tier)).not.toContain('otherText');

    designed.setProperty(tier, 'showOtherItem', true);
    expect(names(designed, tier)).toContain('otherText');
  });

  test('the condition is the survey’s own language, over the element’s own properties', () => {
    const designed = surface({
      pages: [{ name: 'p1', elements: [{ type: 'expression', name: 'total', expression: '1' }] }],
    });
    const total = selectByName(designed, 'total');

    expect(names(designed, total)).not.toContain('currency');

    designed.setProperty(total, 'displayStyle', 'currency');
    expect(names(designed, total)).toContain('currency');
    // `<>` and `or` are the operators an author already knows, because it is the same
    // tokenizer, parser and evaluator a question's own `visibleIf` goes through.
    expect(names(designed, total)).toContain('maximumFractionDigits');
  });

  test('a compound condition reads as one', () => {
    const designed = surface({
      pages: [{ name: 'p1', elements: [{ type: 'text', name: 'who' }] }],
    });
    const who = selectByName(designed, 'who');

    expect(names(designed, who)).not.toContain('requiredErrorText');

    // Either half is enough: `{isRequired} = true or {requiredIf} notempty`.
    designed.setProperty(who, 'requiredIf', '{other} = 1');
    expect(names(designed, who)).toContain('requiredErrorText');
  });

  test('a resolved default counts, not only what was authored', () => {
    const designed = surface(TIER);

    // `showOtherItem` was never written, so the condition is read against the registered
    // default — which is what the designer sees in the field beside it.
    expect(propertyScopeOf(selectByName(designed, 'tier'), registry())['showOtherItem']).toBe(
      false,
    );
  });

  test('a host’s own property may declare a condition too', () => {
    const created = registry();
    created.addProperty('text', { name: 'showHelp', type: 'boolean' });
    created.addProperty('text', {
      name: 'helpText',
      type: 'string',
      visibleIf: '{showHelp} = true',
    });
    const designed = surface({ pages: [{ name: 'p1', elements: [{ type: 'text', name: 'who' }] }] }, created);
    const who = selectByName(designed, 'who');

    // The whole reason the condition is on the descriptor rather than in a table here: a
    // dependency table in the Creator could not have an entry for this.
    expect(names(designed, who)).not.toContain('helpText');
    designed.setProperty(who, 'showHelp', true);
    expect(names(designed, who)).toContain('helpText');
  });

  test('a condition that will not parse is treated as absent', () => {
    const created = registry();
    created.addProperty('text', { name: 'broken', type: 'string', visibleIf: '{a} = = 1' });
    const designed = surface({ pages: [{ name: 'p1', elements: [{ type: 'text', name: 'who' }] }] }, created);

    // Hiding a field because somebody's registration has a typo makes a property
    // unreachable with nothing on screen to say why — and the value is in the definition
    // either way.
    expect(names(designed, selectByName(designed, 'who'))).toContain('broken');
  });
});

describe('parity/L3-read-only', () => {
  test('a property an expression overrides is shown, and fixed', () => {
    const designed = surface({
      pages: [{ name: 'p1', elements: [{ type: 'text', name: 'who', isRequired: true }] }],
    });
    const who = selectByName(designed, 'who');

    expect(rowFor(designed, who, 'isRequired')?.isReadOnly).toBe(false);

    designed.setProperty(who, 'requiredIf', '{other} = 1');

    // Not hidden: the value still matters the moment the expression is cleared, so hiding
    // it would lose a setting a designer had made — where showing it unchangeable says
    // exactly what is going on.
    expect(rowFor(designed, who, 'isRequired')?.isReadOnly).toBe(true);
    expect(rowFor(designed, who, 'isRequired')?.value).toBe(true);
  });

  test('everything else is editable', () => {
    const designed = surface(TIER);
    const tier = selectByName(designed, 'tier');

    expect(designed.properties(tier).flatMap((category) => category.rows).filter((row) => row.isReadOnly)).toEqual(
      [],
    );
  });
});

describe('parity/L3-conditions', () => {
  const cache = new ExpressionCache();

  test('three answers, because two would not be enough', () => {
    // No condition, one that will not parse, and one that fails to evaluate are all "no
    // answer" — and the safe direction differs by caller, so a bare boolean could not
    // carry it.
    expect(conditionOutcome('', {}, cache)).toBeUndefined();
    expect(conditionOutcome('{a} = = 1', {}, cache)).toBeUndefined();
    expect(conditionOutcome('nosuchfunction(1)', {}, cache)).toBeUndefined();
  });

  test('truthiness is the language’s own', () => {
    // Including the rule that an empty collection is falsy, which is why this uses core's
    // `isTruthy` rather than writing `Boolean(value)`.
    expect(conditionOutcome('{a}', { a: [] }, cache)).toBe(false);
    expect(conditionOutcome('{a}', { a: ['x'] }, cache)).toBe(true);
    expect(conditionOutcome('{a}', { a: 0 }, cache)).toBe(false);
  });

  test('a condition is parsed once however often it is asked', () => {
    const own = new ExpressionCache();

    conditionOutcome('{a} = 1', { a: 1 }, own);
    conditionOutcome('{a} = 1', { a: 2 }, own);

    expect(own.size).toBe(1);
  });
});
