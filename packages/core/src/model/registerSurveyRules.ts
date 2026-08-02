import { collectReferences } from '../expressions/collectReferences.js';
import { parseExpression } from '../expressions/parseExpression.js';
import { CONDITIONAL_PROPERTIES } from '../logic/conditionalProperties.js';
import { createValueRule } from '../logic/createValueRule.js';
import type { LogicEngine } from '../logic/LogicEngine.js';
import type { CalculatedValue } from './CalculatedValue.js';
import type { ElementStateController } from './ElementStateController.js';
import type { Page } from './Page.js';
import type { Question } from './Question.js';
import type { SurveyElement } from './SurveyElement.js';

/** What rule registration needs from the survey, without reaching into it. */
export interface RuleHost {
  readonly logic: LogicEngine;
  readonly states: ElementStateController;
  readonly getValue: (name: string) => unknown;
  readonly setValue: (name: string, value: unknown) => void;
  readonly setCalculated: (calculated: CalculatedValue, value: unknown) => void;
}

/** A non-blank string property, or undefined. */
export function stringProperty(element: SurveyElement, name: string): string | undefined {
  const value = element.getPropertyValue(name);
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function registerConditions(element: SurveyElement, owner: string, host: RuleHost): void {
  for (const conditional of CONDITIONAL_PROPERTIES) {
    const expression = stringProperty(element, conditional.property);
    if (expression === undefined) {
      host.states.clear(element, conditional.state);
      continue;
    }
    host.logic.addCondition({
      key: `${owner}:${conditional.property}`,
      expression,
      fallback: conditional.fallback,
      apply: (result) => {
        host.states.apply(element, conditional.state, result);
      },
    });
  }
}

function registerCalculatedValue(calculated: CalculatedValue, host: RuleHost): void {
  const expression = stringProperty(calculated, 'expression');
  const name = calculated.name;
  if (expression === undefined || name.length === 0) {
    return;
  }
  host.logic.addRule({
    key: `calculatedValue:${name}`,
    reads: collectReferences(parseExpression(expression).node),
    // Declared, so anything reading this value is ordered after it in one pass.
    writes: [{ kind: 'name', name }],
    run: (context) => {
      const evaluation = context.evaluate(expression);
      if (evaluation.errors.length === 0) {
        host.setCalculated(calculated, evaluation.value);
      }
    },
  });
}

function registerValueRule(question: Question, owner: string, host: RuleHost): void {
  const rule = createValueRule(
    `${owner}:value`,
    {
      resetValueIf: stringProperty(question, 'resetValueIf'),
      setValueIf: stringProperty(question, 'setValueIf'),
      setValueExpression: stringProperty(question, 'setValueExpression'),
      defaultValueExpression: stringProperty(question, 'defaultValueExpression'),
    },
    {
      path: [{ kind: 'name', name: question.name }],
      getValue: () => host.getValue(question.name),
      setValue: (value) => {
        host.setValue(question.name, value);
      },
      clearValue: () => {
        host.setValue(question.name, undefined);
      },
    },
  );
  if (rule !== undefined) {
    host.logic.addRule(rule);
  }
}

/**
 * Registers every rule the definition declares.
 *
 * Calculated values go first only for readability — the dependency graph orders
 * execution from declared reads and writes, not from registration order.
 */
export function registerSurveyRules(
  pages: readonly Page[],
  calculatedValues: readonly CalculatedValue[],
  host: RuleHost,
): void {
  for (const calculated of calculatedValues) {
    registerCalculatedValue(calculated, host);
  }
  for (const page of pages) {
    registerConditions(page, `page:${page.name}`, host);
    for (const question of page.elements) {
      const owner = `question:${question.name}`;
      registerConditions(question, owner, host);
      registerValueRule(question, owner, host);
    }
  }
}
