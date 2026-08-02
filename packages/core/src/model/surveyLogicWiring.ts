import type { PathSegment } from '../expressions/ExpressionNode.js';
import type { LogicEngine } from '../logic/LogicEngine.js';
import type { CalculatedValue } from './CalculatedValue.js';
import type { ChoiceSourceController } from './ChoiceSourceController.js';
import type { LazyChoiceController } from './LazyChoiceController.js';
import type { ElementStateController } from './ElementStateController.js';
import { registerSurveyRules } from './registerSurveyRules.js';
import type { RuleHost } from './registerSurveyRules.js';
import type { SettleCoordinator } from './SettleCoordinator.js';
import type { SurveyAnswers } from './SurveyAnswers.js';
import type { SurveyChildren } from './SurveyChildren.js';

/** The parts of the survey that rule registration reaches back into. */
export interface SurveyLogicDependencies {
  readonly logic: LogicEngine;
  readonly states: ElementStateController;
  readonly settle: SettleCoordinator;
  readonly choiceSources: ChoiceSourceController;
  readonly lazyChoices: LazyChoiceController;
  readonly answers: SurveyAnswers;
  readonly resolvePath: (path: readonly PathSegment[]) => unknown;
  readonly getValue: (name: string) => unknown;
  readonly writeValue: (name: string, value: unknown) => boolean;
  readonly complete: () => void;
  readonly goTo: (name: string) => void;
  readonly findQuestion: RuleHost['findQuestion'];
}

/**
 * Rebuilds every rule from the current tree and evaluates them once.
 *
 * Registration is deliberately a whole-tree rebuild rather than incremental: getting
 * it wrong means logic that silently stops running, and re-registering a handful of
 * expressions is cheap next to that risk.
 */
export function refreshSurveyLogic(
  children: SurveyChildren,
  dependencies: SurveyLogicDependencies,
): void {
  dependencies.logic.clear();
  registerSurveyRules(children, createSurveyRuleHost(dependencies));
  dependencies.settle.run(() => dependencies.logic.evaluateAll(dependencies.resolvePath));
}

/**
 * Records a computed value and decides whether anyone hears about it.
 *
 * Announced only when it reaches `data`: `onValueChanged` means "an answer changed",
 * and reporting a value the host cannot find in `data` would mislead.
 */
function setCalculated(
  dependencies: SurveyLogicDependencies,
  calculated: CalculatedValue,
  value: unknown,
): boolean {
  const { changed, previousValue } = dependencies.answers.writeCalculated(
    calculated.name,
    value,
  );
  if (changed && calculated.includeIntoResult) {
    dependencies.settle.queueValue({ name: calculated.name, value, previousValue });
  }
  return changed;
}

/**
 * Assembles the seam between the survey and its rules.
 *
 * A separate module because it is the one place that decides *when a change escapes*:
 * both announcers below deal with an update arriving outside a settle — a respondent
 * collapsing a panel, a REST response landing after the transaction that asked for it —
 * and neither would otherwise reach a renderer. Keeping that judgement in one readable
 * place beats burying it in the middle of the model.
 */
function createSurveyRuleHost(dependencies: SurveyLogicDependencies): RuleHost {
  const { states, settle } = dependencies;

  return {
    logic: dependencies.logic,
    states,
    choiceSources: dependencies.choiceSources,
    lazyChoices: dependencies.lazyChoices,
    getValue: dependencies.getValue,
    setValue: dependencies.writeValue,
    setCalculated: (calculated, value) => setCalculated(dependencies, calculated, value),
    complete: dependencies.complete,
    goTo: dependencies.goTo,
    findQuestion: dependencies.findQuestion,
    resolveValue: (name) => dependencies.resolvePath([{ kind: 'name', name }]),

    announcePanelCollapsed: (panel) => {
      panel.setCollapseAnnouncer((isCollapsed) => {
        states.notifyCollapsedChanged(panel, isCollapsed);
        // A respondent toggling a panel is not part of a settle, so nothing else
        // would flush the event.
        settle.release();
      });
    },

    announceChoices: (question) => {
      states.notifyChoicesChanged(question);
      // A REST response lands after the settle that asked for it, so nothing else
      // would flush the event it produced.
      if (!settle.isSettling) {
        settle.release();
      }
    },
  };
}
