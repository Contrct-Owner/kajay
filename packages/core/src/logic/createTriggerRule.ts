import { collectReferences } from '../expressions/collectReferences.js';
import type { PropertyValue } from '../metadata/PropertyDescriptor.js';
import { isTruthy } from '../expressions/expressionValues.js';
import { parseExpression } from '../expressions/parseExpression.js';
import type { LogicRule, RuleContext } from './LogicRule.js';

export type TriggerKind = 'complete' | 'setvalue' | 'copyvalue' | 'runexpression' | 'skip';

/** A trigger flattened to plain data, so this module never imports the model. */
export interface TriggerDescriptor {
  readonly kind: TriggerKind;
  readonly expression: string;
  readonly setToName: string | undefined;
  readonly setValue: PropertyValue | undefined;
  readonly fromName: string | undefined;
  readonly runExpression: string | undefined;
  readonly gotoName: string | undefined;
}

/** What a trigger is allowed to do to the survey. */
export interface TriggerActions {
  readonly getValue: (name: string) => unknown;
  readonly setValue: (name: string, value: unknown) => boolean;
  readonly complete: () => void;
  readonly goTo: (name: string) => void;
}

function performAction(
  trigger: TriggerDescriptor,
  actions: TriggerActions,
  context: RuleContext,
): boolean {
  switch (trigger.kind) {
    case 'complete':
      actions.complete();
      return false;
    case 'skip':
      if (trigger.gotoName !== undefined) {
        actions.goTo(trigger.gotoName);
      }
      return false;
    case 'setvalue':
      if (trigger.setToName !== undefined && trigger.setValue !== undefined) {
        return actions.setValue(trigger.setToName, trigger.setValue);
      }
      return false;
    case 'copyvalue':
      if (trigger.setToName !== undefined && trigger.fromName !== undefined) {
        return actions.setValue(trigger.setToName, actions.getValue(trigger.fromName));
      }
      return false;
    case 'runexpression': {
      if (trigger.runExpression === undefined) {
        return false;
      }
      const evaluation = context.evaluate(trigger.runExpression);
      if (evaluation.errors.length === 0 && trigger.setToName !== undefined) {
        return actions.setValue(trigger.setToName, evaluation.value);
      }
      return false;
    }
  }
}

/**
 * Builds the rule for one trigger.
 *
 * Triggers fire on the **transition** into true, not while the condition stays true.
 * That is the difference between a trigger and `setValueIf`: a trigger is an event, so
 * a `complete` trigger completes once rather than on every recomputation, and a
 * `setvalue` trigger does not overwrite an answer the respondent edits afterwards.
 *
 * The first evaluation only establishes the baseline. A definition loaded with its
 * condition already true has not *become* true, and firing on load would complete a
 * survey before the respondent saw it.
 */
export function createTriggerRule(
  key: string,
  trigger: TriggerDescriptor,
  actions: TriggerActions,
): LogicRule | undefined {
  if (trigger.expression.trim().length === 0) {
    return undefined;
  }

  let established = false;
  let wasTrue = false;

  const writes =
    trigger.setToName === undefined || trigger.kind === 'complete' || trigger.kind === 'skip'
      ? undefined
      : [{ kind: 'name' as const, name: trigger.setToName }];

  return {
    key,
    // Only the condition is a dependency. What the trigger reads *when it fires* —
    // `fromName`, `runExpression` — is read at that moment and must not re-trigger it.
    reads: collectReferences(parseExpression(trigger.expression).node),
    ...(writes === undefined ? {} : { writes }),
    run: (context) => {
      const evaluation = context.evaluate(trigger.expression);
      if (evaluation.errors.length > 0) {
        return [];
      }
      const isTrue = isTruthy(evaluation.value);
      const becameTrue = established && isTrue && !wasTrue;
      established = true;
      wasTrue = isTrue;

      if (becameTrue) {
        const changed = performAction(trigger, actions, context);
        return changed && writes !== undefined ? [writes] : [];
      }
      return [];
    },
  };
}
