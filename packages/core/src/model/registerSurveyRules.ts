import { collectReferences } from '../expressions/collectReferences.js';
import { parseExpression } from '../expressions/parseExpression.js';
import { CONDITIONAL_PROPERTIES } from '../logic/conditionalProperties.js';
import { createCarryForwardRule } from '../logic/createCarryForwardRule.js';
import type { CarryForwardMode } from '../logic/createCarryForwardRule.js';
import { createChoicesByUrlRule } from '../logic/createChoicesByUrlRule.js';
import type { ChoiceFetcher } from '../logic/createChoicesByUrlRule.js';
import { createTriggerRule } from '../logic/createTriggerRule.js';
import { createValueRule } from '../logic/createValueRule.js';
import type { LogicEngine } from '../logic/LogicEngine.js';
import type { PropertyValue } from '../metadata/PropertyDescriptor.js';
import type { CalculatedValue } from './CalculatedValue.js';
import { ItemValue } from './ItemValue.js';
import type { ElementStateController } from './ElementStateController.js';
import type { Question } from './Question.js';
import { SelectQuestion } from './SelectQuestion.js';
import type { SurveyChildren } from './SurveyChildren.js';
import type { SurveyElement } from './SurveyElement.js';
import type { Trigger } from './Trigger.js';

/** What rule registration needs from the survey, without reaching into it. */
export interface RuleHost {
  readonly logic: LogicEngine;
  readonly states: ElementStateController;
  readonly getValue: (name: string) => unknown;
  readonly setValue: (name: string, value: unknown) => void;
  readonly setCalculated: (calculated: CalculatedValue, value: unknown) => void;
  readonly complete: () => void;
  readonly goTo: (name: string) => void;
  readonly findQuestion: (name: string) => Question | undefined;
  readonly announceChoices: (question: SelectQuestion) => void;
  readonly fetchJson: ChoiceFetcher | undefined;
  readonly resolveValue: (name: string) => unknown;
  readonly reportChoiceError: (message: string) => void;
  readonly choiceCache: Map<string, readonly ItemValue[]>;
}

/**
 * A question's choices may come from elsewhere: carried forward from another
 * question, or loaded from a URL. At most one source is active — declaring both is an
 * authoring mistake, and carry-forward wins because it is the one that resolves
 * synchronously and therefore predictably.
 */
function registerCarryForward(
  question: SelectQuestion,
  sourceName: string,
  owner: string,
  host: RuleHost,
): void {
  host.logic.addRule(
    createCarryForwardRule(
      `${owner}:choicesFromQuestion`,
      sourceName,
      toMode(question.choicesFromQuestionMode),
      {
        getSourceChoices: () => {
          const source = host.findQuestion(sourceName);
          return source instanceof SelectQuestion ? source.visibleChoices : undefined;
        },
        getSourceValue: () => host.resolveValue(sourceName),
        installProvider: (provider) => {
          question.setChoiceProvider(provider);
        },
        announce: () => {
          host.announceChoices(question);
        },
      },
    ),
  );
}

function registerChoicesByUrl(
  question: SelectQuestion,
  url: string,
  owner: string,
  host: RuleHost,
): void {
  host.logic.addRule(
    createChoicesByUrlRule(
      `${owner}:choicesByUrl`,
      {
        url,
        path: question.choicesPath,
        valueName: question.choicesValueName,
        titleName: question.choicesTitleName,
      },
      {
        fetchJson: host.fetchJson,
        resolvePlaceholder: host.resolveValue,
        createChoice: (value, text) => {
          const item = new ItemValue();
          item.value = toPropertyValue(value);
          item.text = text === null || text === undefined ? '' : String(text);
          return item;
        },
        installProvider: (provider) => {
          question.setChoiceProvider(provider);
        },
        clearProvider: () => {
          question.clearChoiceProvider();
        },
        announce: () => {
          host.announceChoices(question);
        },
        reportError: host.reportChoiceError,
        cache: host.choiceCache,
      },
    ),
  );
}

/**
 * A question's choices may come from elsewhere: carried forward from another question,
 * or loaded from a URL. At most one source is active — declaring both is an authoring
 * mistake, and carry-forward wins because it resolves synchronously and therefore
 * predictably.
 */
function registerChoiceSource(question: Question, owner: string, host: RuleHost): void {
  if (!(question instanceof SelectQuestion)) {
    return;
  }
  const carryForward = optionalString(question.choicesFromQuestion);
  if (carryForward !== undefined) {
    registerCarryForward(question, carryForward, owner, host);
    return;
  }
  const url = optionalString(question.choicesByUrl);
  if (url !== undefined) {
    registerChoicesByUrl(question, url, owner, host);
  }
}

function toMode(mode: string): CarryForwardMode {
  return mode === 'selected' || mode === 'unselected' ? mode : 'all';
}

function toPropertyValue(value: unknown): PropertyValue {
  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : String(value ?? '');
}

function optionalString(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}

function registerTrigger(trigger: Trigger, index: number, host: RuleHost): void {
  const setValue = trigger.getPropertyValue('setValue');
  const rule = createTriggerRule(
    `trigger:${index}:${trigger.kind}`,
    {
      kind: trigger.kind,
      expression: trigger.expression,
      setToName: optionalString(trigger.setToName),
      setValue,
      fromName: optionalString(trigger.fromName),
      runExpression: optionalString(trigger.runExpression),
      gotoName: optionalString(trigger.gotoName),
    },
    {
      getValue: host.getValue,
      setValue: host.setValue,
      complete: host.complete,
      goTo: host.goTo,
    },
  );
  if (rule !== undefined) {
    host.logic.addRule(rule);
  }
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
 * Individual choices carry their own `visibleIf`.
 *
 * Choices are keyed by index rather than by value, because two choices may legitimately
 * share a value and a rule key has to be unique.
 */
function registerChoiceConditions(question: Question, owner: string, host: RuleHost): void {
  if (!(question instanceof SelectQuestion)) {
    return;
  }
  for (const [index, choice] of question.choices.entries()) {
    registerConditions(choice, `${owner}:choice:${index}`, host);
  }
}

/**
 * Registers every rule the definition declares.
 *
 * Calculated values go first only for readability — the dependency graph orders
 * execution from declared reads and writes, not from registration order.
 */
export function registerSurveyRules(children: SurveyChildren, host: RuleHost): void {
  for (const calculated of children.calculatedValues) {
    registerCalculatedValue(calculated, host);
  }
  for (const [index, trigger] of children.triggers.entries()) {
    registerTrigger(trigger, index, host);
  }
  for (const page of children.pages) {
    registerConditions(page, `page:${page.name}`, host);
    for (const question of page.elements) {
      const owner = `question:${question.name}`;
      registerConditions(question, owner, host);
      registerValueRule(question, owner, host);
      registerChoiceConditions(question, owner, host);
      registerChoiceSource(question, owner, host);
    }
  }
}
