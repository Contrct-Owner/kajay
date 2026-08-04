/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface, LogicSession } from '@kajay/creator-core';
import { LogicPanel } from '@kajay/creator-react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/** The visual logic editor — checklist M1. */
const BASIC: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'radiogroup', name: 'tier', title: 'Which tier?', choices: ['bronze', 'silver'] },
        { type: 'text', name: 'why', visibleIf: "{tier} = 'silver'" },
        { type: 'text', name: 'hard', visibleIf: '({tier} = 1 or {tier} = 2) and {why} notempty' },
      ],
    },
  ],
};

function surface(definition: SurveyDefinition = BASIC): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition, registry });
}

function visibleIf(designed: DesignSurface, name: string): unknown {
  return designed.survey.getQuestionByName(name)?.getPropertyValue('visibleIf');
}

test('parity/M1-logic-rules: every rule is listed with what it does', async () => {
  const designed = surface();
  const session = new LogicSession(designed);
  const screen = await render(<LogicPanel session={session} />);

  await expect.element(screen.getByTestId('logic-rule-why:visibleIf')).toHaveTextContent(
    'Show why when',
  );
  session.dispose();
});

test('parity/M1-condition-build: the question, operator and value are dropdowns', async () => {
  const designed = surface();
  const session = new LogicSession(designed);
  const screen = await render(<LogicPanel session={session} />);

  // The value is a *picker* because the question it tests has choices — read off the
  // model, so a host's own select type gets one too.
  await screen.getByTestId('logic-value-why:visibleIf-0').selectOptions('bronze');

  expect(visibleIf(designed, 'why')).toBe("{tier} == 'bronze'");
  session.dispose();
});

test('parity/M1-condition-build: changing the operator rewrites the expression', async () => {
  const designed = surface();
  const session = new LogicSession(designed);
  const screen = await render(<LogicPanel session={session} />);

  await screen.getByTestId('logic-operator-why:visibleIf-0').selectOptions('notempty');

  expect(visibleIf(designed, 'why')).toBe('{tier} notempty');

  await screen.getByTestId('logic-operator-why:visibleIf-0').selectOptions('==');

  // The value went with the operator that took one. Remembering `silver` would be friendlier
  // and would make the row disagree with the definition, which drops it either way.
  expect(visibleIf(designed, 'why')).toBe("{tier} == ''");
  session.dispose();
});

test('parity/M1-condition-build: a second condition joins the first', async () => {
  const designed = surface();
  const session = new LogicSession(designed);
  const screen = await render(<LogicPanel session={session} />);

  // One condition needs no join picker: there is nothing to join it to.
  expect(screen.container.querySelector('[data-testid="logic-join-why:visibleIf"]')).toBeNull();

  await screen.getByTestId('logic-add-term-why:visibleIf').click();

  expect(String(visibleIf(designed, 'why'))).toContain(' and ');
  await expect.element(screen.getByTestId('logic-join-why:visibleIf')).toBeInTheDocument();

  await screen.getByTestId('logic-join-why:visibleIf').selectOptions('or');
  expect(String(visibleIf(designed, 'why'))).toContain(' or ');
  session.dispose();
});

test('parity/M1-condition-refusals: what the builder cannot say stays text', async () => {
  const designed = surface();
  const session = new LogicSession(designed);
  const screen = await render(<LogicPanel session={session} />);

  // Shown, explained, and still editable — taking the field away would mean the tab
  // silently owned less of the survey than it listed.
  await expect.element(screen.getByTestId('logic-raw-hard:visibleIf')).toHaveValue(
    '({tier} = 1 or {tier} = 2) and {why} notempty',
  );
  await expect.element(screen.getByTestId('logic-raw-note-hard:visibleIf')).toBeInTheDocument();
  expect(screen.container.querySelector('[data-testid="logic-term-hard:visibleIf-0"]')).toBeNull();

  await screen.getByTestId('logic-raw-hard:visibleIf').fill('{tier} notempty');
  // Now it *is* sayable, so the row becomes a builder rather than staying text.
  await expect.element(screen.getByTestId('logic-term-hard:visibleIf-0')).toBeInTheDocument();
  session.dispose();
});

test('parity/M1-logic-edits: a rule can be added and removed', async () => {
  const designed = surface();
  const session = new LogicSession(designed);
  const screen = await render(<LogicPanel session={session} />);

  await screen.getByLabelText('What the new rule does').selectOptions('require');
  await screen.getByLabelText('What the new rule acts on').selectOptions('why');
  await screen.getByTestId('logic-add-rule').click();

  await expect.element(screen.getByTestId('logic-rule-why:requiredIf')).toBeInTheDocument();

  await screen.getByTestId('logic-remove-why:requiredIf').click();
  expect(screen.container.querySelector('[data-testid="logic-rule-why:requiredIf"]')).toBeNull();
  session.dispose();
});

test('parity/M1-logic-rules: an empty survey says so rather than showing an empty list', async () => {
  const designed = surface({ pages: [{ name: 'p1', elements: [{ type: 'text', name: 'a' }] }] });
  const session = new LogicSession(designed);
  const screen = await render(<LogicPanel session={session} />);

  await expect.element(screen.getByText('This survey has no logic yet.')).toBeInTheDocument();
  session.dispose();
});
