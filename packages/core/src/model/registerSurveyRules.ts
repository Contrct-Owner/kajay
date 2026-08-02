import { collectReferences } from '../expressions/collectReferences.js';
import { parseExpression } from '../expressions/parseExpression.js';
import { CONDITIONAL_PROPERTIES } from '../logic/conditionalProperties.js';
import { createTriggerRule } from '../logic/createTriggerRule.js';
import { createValueRule } from '../logic/createValueRule.js';
import type { LogicEngine } from '../logic/LogicEngine.js';
import type { CalculatedValue } from './CalculatedValue.js';
import type { CarryForwardMode, ChoiceSourceController } from './ChoiceSourceController.js';
import type { ElementStateController } from './ElementStateController.js';
import type { LazyChoiceController } from './LazyChoiceController.js';
import { ExpressionQuestion } from './ExpressionQuestion.js';
import type { PageElement } from './PageElement.js';
import { Panel } from './Panel.js';
import { Question } from './Question.js';
import { SelectQuestion } from './SelectQuestion.js';
import type { SurveyChildren } from './SurveyChildren.js';
import type { SurveyElement } from './SurveyElement.js';
import type { Trigger } from './Trigger.js';

/** What rule registration needs from the survey, without reaching into it. */
export interface RuleHost {
  readonly logic: LogicEngine;
  readonly states: ElementStateController;
  readonly getValue: (name: string) => unknown;
  readonly setValue: (name: string, value: unknown) => boolean;
  readonly setCalculated: (calculated: CalculatedValue, value: unknown) => boolean;
  readonly complete: () => void;
  readonly goTo: (name: string) => void;
  readonly findQuestion: (name: string) => Question | undefined;
  readonly announceChoices: (question: SelectQuestion) => void;
  /** Wires a panel's collapse toggle to the renderer's subscription. */
  readonly announcePanelCollapsed: (panel: Panel) => void;
  readonly choiceSources: ChoiceSourceController;
  readonly lazyChoices: LazyChoiceController;
  readonly resolveValue: (name: string) => unknown;
}

function registerCarryForward(
  question: SelectQuestion,
  sourceName: string,
  owner: string,
  host: RuleHost,
): void {
  host.logic.addRule(
    host.choiceSources.createCarryForwardRule({
      key: `${owner}:choicesFromQuestion`,
      question,
      sourceName,
      mode: toMode(question.choicesFromQuestionMode),
      getSourceChoices: () => {
        const source = host.findQuestion(sourceName);
        return source instanceof SelectQuestion ? source.visibleChoices : undefined;
      },
      getSourceValue: () => host.resolveValue(sourceName),
      announce: () => {
        host.announceChoices(question);
      },
    }),
  );
}

function registerChoicesByUrl(
  question: SelectQuestion,
  url: string,
  owner: string,
  host: RuleHost,
): void {
  host.logic.addRule(
    host.choiceSources.createUrlRule({
      key: `${owner}:choicesByUrl`,
      question,
      url,
      resolvePlaceholder: host.resolveValue,
      announce: () => {
        host.announceChoices(question);
      },
    }),
  );
}

/**
 * A question's choices may come from elsewhere: carried forward from another question,
 * loaded whole from a URL, or paged in from the host. At most one source is active —
 * declaring more than one is an authoring mistake, and the first named here wins.
 * Carry-forward leads because it resolves synchronously and therefore predictably.
 */
function registerChoiceSource(question: Question, owner: string, host: RuleHost): void {
  if (!(question instanceof SelectQuestion)) {
    return;
  }
  const key = `${owner}:choicesByUrl`;
  const hadDynamicChoices = question.hasDynamicChoices;
  question.clearChoiceProvider();

  const carryForward = optionalString(question.choicesFromQuestion);
  if (carryForward !== undefined) {
    host.choiceSources.invalidate(key);
    host.lazyChoices.detach(question);
    registerCarryForward(question, carryForward, owner, host);
    return;
  }
  const url = optionalString(question.choicesByUrl);
  if (url !== undefined) {
    host.lazyChoices.detach(question);
    registerChoicesByUrl(question, url, owner, host);
    return;
  }

  host.choiceSources.invalidate(key);
  if (question.choicesLazyLoadEnabled) {
    host.lazyChoices.attach(question, () => {
      host.announceChoices(question);
    });
    return;
  }

  host.lazyChoices.detach(question);
  if (hadDynamicChoices) {
    host.announceChoices(question);
  }
}

function toMode(mode: string): CarryForwardMode {
  return mode === 'selected' || mode === 'unselected' ? mode : 'all';
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
      if (evaluation.errors.length > 0) {
        return [];
      }
      return host.setCalculated(calculated, evaluation.value)
        ? [[{ kind: 'name' as const, name }]]
        : [];
    },
  });
}

/**
 * An expression question's answer is its expression, always.
 *
 * Its own rule rather than reusing `defaultValueExpression`, because a default yields
 * to the respondent the moment they type over it — and there is nothing to type over
 * here. The write is declared, so anything reading this value is ordered after it in a
 * single pass, exactly as for a calculated value.
 */
function registerExpressionValue(question: Question, owner: string, host: RuleHost): void {
  if (!(question instanceof ExpressionQuestion)) {
    return;
  }
  const expression = stringProperty(question, 'expression');
  if (expression === undefined) {
    return;
  }
  const path = [{ kind: 'name' as const, name: question.name }];
  host.logic.addRule({
    key: `${owner}:expression`,
    reads: collectReferences(parseExpression(expression).node),
    writes: path,
    run: (context) => {
      const evaluation = context.evaluate(expression);
      // A malformed expression writes nothing. Putting a wrong value into someone's
      // response is worse than leaving it blank — the same rule the value rules follow.
      if (evaluation.errors.length > 0) {
        return [];
      }
      return host.setValue(question.name, evaluation.value) ? [path] : [];
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
      setValue: (value) => host.setValue(question.name, value),
      clearValue: () => host.setValue(question.name, undefined),
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
    registerElements(page.elements, host);
  }
}

/**
 * Registers a page's element tree, descending through panels.
 *
 * A panel contributes its own conditions and nothing else — it holds no answer and no
 * choices — but its children are ordinary elements and must not be skipped because of
 * the container they happen to sit in.
 */
function registerElements(elements: readonly PageElement[], host: RuleHost): void {
  for (const element of elements) {
    if (element instanceof Panel) {
      registerConditions(element, `panel:${element.name}`, host);
      host.announcePanelCollapsed(element);
      registerElements(element.elements, host);
      continue;
    }
    if (!(element instanceof Question)) {
      // A display element holds no answer and no choices, so none of the rules below
      // apply — but it is on the page, and `visibleIf` has to mean the same thing for
      // a paragraph of text as for the question beside it.
      registerConditions(element, `element:${element.name}`, host);
      continue;
    }
    const owner = `question:${element.name}`;
    registerConditions(element, owner, host);
    registerValueRule(element, owner, host);
    registerExpressionValue(element, owner, host);
    registerChoiceConditions(element, owner, host);
    registerChoiceSource(element, owner, host);
  }
}
