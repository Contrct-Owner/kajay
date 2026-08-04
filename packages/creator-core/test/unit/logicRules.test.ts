import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface, LOGIC_TEMPLATES, LogicSession } from '@kajay/creator-core';
import { afterEach, describe, expect, test } from 'vitest';

/** The visual logic editor — checklist M1. */
const BASIC: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'radiogroup', name: 'tier', title: 'Which tier?', choices: ['bronze', 'silver'] },
        { type: 'text', name: 'why', visibleIf: "{tier} = 'silver'" },
        { type: 'text', name: 'code', requiredIf: '{tier} notempty', enableIf: '{why} notempty' },
        {
          type: 'text',
          name: 'total',
          setValueIf: '{tier} notempty',
          setValueExpression: '{tier} + 1',
        },
      ],
    },
    { name: 'p2', elements: [{ type: 'text', name: 'notes' }] },
  ],
  triggers: [
    { type: 'skip', expression: "{tier} = 'bronze'", gotoName: 'p2' },
    { type: 'complete', expression: '{notes} notempty' },
  ],
};

const open: LogicSession[] = [];

function surface(definition: SurveyDefinition = BASIC): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition, registry });
}

function session(designed: DesignSurface): LogicSession {
  const made = new LogicSession(designed);
  open.push(made);
  return made;
}

afterEach(() => {
  for (const made of open.splice(0)) {
    made.dispose();
  }
});

describe('parity/M1-logic-rules', () => {
  test('every conditional property and every trigger is a rule', () => {
    const rules = session(surface()).rules;

    expect(rules.map((rule) => rule.id)).toEqual([
      'why:visibleIf',
      'code:enableIf',
      'code:requiredIf',
      'total:setValueIf',
      'trigger:0',
      'trigger:1',
    ]);
  });

  test('a rule says what it does and what it acts on', () => {
    const rules = session(surface()).rules;

    expect(rules[0]).toMatchObject({ action: 'show', subject: 'why' });
    // An element rule's argument is its *own* second property: `setValueIf` says when, and
    // `setValueExpression` says what.
    expect(rules[3]).toMatchObject({
      action: 'setValue',
      subject: 'total',
      argument: '{tier} + 1',
    });
    expect(rules[4]).toMatchObject({ action: 'skip', subject: 'survey', argument: 'p2' });
    expect(rules[5]).toMatchObject({ action: 'complete', argument: '' });
  });

  test('a property with no condition is not a rule', () => {
    // `notes` carries none, and a row with an empty condition column would be a rule the
    // definition does not have — canonical form elides it.
    expect(session(surface()).rules.some((rule) => rule.subject === 'notes')).toBe(false);
  });

  test('`defaultValueExpression` is deliberately not a rule', () => {
    const designed = surface({
      pages: [{ name: 'p1', elements: [{ type: 'text', name: 'a', defaultValueExpression: '1' }] }],
    });

    // It has no condition — it is a value computed always rather than when something holds
    // — so the property grid is where it belongs.
    expect(session(designed).rules).toEqual([]);
  });

  test('a trigger’s own expression is listed once, as its condition', () => {
    const rules = session(surface()).rules.filter((rule) => rule.id.startsWith('trigger'));

    // Walking into `triggers` as if it held elements would offer each expression twice.
    expect(rules).toHaveLength(2);
    expect(rules[0]?.conditionText).toBe("{tier} = 'bronze'");
  });

  test('the list is derived, so deleting a question takes its rules with it', () => {
    const designed = surface();
    const made = session(designed);
    expect(made.rules).toHaveLength(6);

    designed.removeElement('why');

    expect(made.rules.map((rule) => rule.id)).not.toContain('why:visibleIf');
  });

  test('a rule carries its condition as terms when the builder can say it', () => {
    const rules = session(surface()).rules;

    expect(rules[0]?.condition?.terms).toEqual([
      { left: 'tier', operator: '==', right: 'silver' },
    ]);
  });

  test('a rule the builder cannot say keeps its text and no terms', () => {
    const designed = surface({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'a' },
            { type: 'text', name: 'b', visibleIf: '({a} = 1 or {a} = 2) and {a} notempty' },
          ],
        },
      ],
    });

    const rule = session(designed).rules[0];
    expect(rule?.condition).toBeUndefined();
    expect(rule?.conditionText).toBe('({a} = 1 or {a} = 2) and {a} notempty');
  });
});

describe('parity/M1-logic-edits', () => {
  test('building a condition writes an expression, and is undoable', () => {
    const designed = surface();
    const made = session(designed);
    const rule = made.rules[0]!;

    expect(
      made.setCondition(rule, {
        terms: [{ left: 'tier', operator: '==', right: 'bronze' }],
        join: 'and',
      }),
    ).toBeUndefined();

    expect(designed.survey.getQuestionByName('why')?.getPropertyValue('visibleIf')).toBe(
      "{tier} == 'bronze'",
    );
    designed.undo();
    expect(designed.survey.getQuestionByName('why')?.getPropertyValue('visibleIf')).toBe(
      "{tier} = 'silver'",
    );
  });

  test('a trigger’s condition is written the same way a question’s is', () => {
    const designed = surface();
    const made = session(designed);
    const rule = made.rules.find((candidate) => candidate.id === 'trigger:0')!;

    made.setConditionText(rule, '{tier} notempty');

    expect(designed.survey.getChildren('triggers')[0]?.getPropertyValue('expression')).toBe(
      '{tier} notempty',
    );
  });

  test('an action’s own argument is editable', () => {
    const designed = surface();
    const made = session(designed);
    const rule = made.rules.find((candidate) => candidate.id === 'trigger:0')!;

    made.setArgument(rule, 'gotoName', 'p1');

    expect(made.rules.find((candidate) => candidate.id === 'trigger:0')?.argument).toBe('p1');
  });

  test('removing a property rule empties it; removing a trigger deletes it', () => {
    const designed = surface();
    const made = session(designed);

    made.removeRule(made.rules.find((rule) => rule.id === 'why:visibleIf')!);
    expect(designed.definition['pages']).toBeDefined();
    expect(JSON.stringify(designed.definition)).not.toContain('visibleIf');

    made.removeRule(made.rules.find((rule) => rule.id === 'trigger:1')!);
    const left = designed.survey.getChildren('triggers');
    // The *second* one went. A trigger is keyed by position, so removing by anything but
    // that position deletes somebody else's rule.
    expect(left).toHaveLength(1);
    expect(left[0]?.type).toBe('skip');
  });

  test('adding a rule never adds an empty one', () => {
    const designed = surface();
    const made = session(designed);
    const before = made.rules.length;

    made.addRule(LOGIC_TEMPLATES.find((template) => template.action === 'show')!, 'notes');

    // A condition of `""` is elided by canonical form, so a row added with nothing in it
    // would vanish on the next re-parse.
    const added = made.rules.find((rule) => rule.id === 'notes:visibleIf');
    expect(made.rules).toHaveLength(before + 1);
    expect(added?.conditionText.length).toBeGreaterThan(0);
  });

  test('adding a trigger rule creates the trigger and gives it a condition', () => {
    const designed = surface();
    const made = session(designed);

    made.addRule(LOGIC_TEMPLATES.find((template) => template.action === 'complete')!, '');

    expect(designed.survey.getChildren('triggers')).toHaveLength(3);
    expect(made.rules.at(-1)?.conditionText.length).toBeGreaterThan(0);
  });
});

describe('parity/M1-logic-choices', () => {
  test('a question with choices offers them as values', () => {
    expect(session(surface()).choicesFor('tier')).toEqual(['bronze', 'silver']);
  });

  test('a question without them offers nothing, which is not the same as no choices', () => {
    expect(session(surface()).choicesFor('why')).toEqual([]);
    expect(session(surface()).choicesFor('nothing-answers-to-this')).toEqual([]);
  });

  test('a trigger walked into as an element produces no rule of its own', () => {
    const rules = session(surface()).rules;

    // Its `expression` is the condition of the rule it *is*, never a rule in its own right.
    expect(rules.filter((rule) => rule.id.startsWith('trigger'))).toHaveLength(2);
    expect(rules.every((rule) => rule.action !== 'runExpression')).toBe(true);
  });

  test('the subjects are the pages and everything on them', () => {
    expect(session(surface()).subjects).toEqual([
      'p1',
      'tier',
      'why',
      'code',
      'total',
      'p2',
      'notes',
    ]);
  });
});
