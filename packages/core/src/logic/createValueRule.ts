import type { DependencyPattern } from '../dependencies/DependencyPattern.js';
import { formatPattern } from '../dependencies/DependencyPattern.js';
import { collectReferences } from '../expressions/collectReferences.js';
import type { PathSegment } from '../expressions/ExpressionNode.js';
import { isEmptyValue, isTruthy } from '../expressions/expressionValues.js';
import { parseExpression } from '../expressions/parseExpression.js';
import type { LogicRule, RuleContext } from './LogicRule.js';

/** The value-writing expressions a question may declare. */
export interface ValueRuleExpressions {
  readonly resetValueIf: string | undefined;
  readonly setValueIf: string | undefined;
  readonly setValueExpression: string | undefined;
  readonly defaultValueExpression: string | undefined;
}

export interface ValueRuleTarget {
  /** Where the answer lives; declared to the graph as this rule's write. */
  readonly path: readonly PathSegment[];
  readonly getValue: () => unknown;
  readonly setValue: (value: unknown) => void;
  readonly clearValue: () => void;
}

function present(expression: string | undefined): string | undefined {
  return expression !== undefined && expression.trim().length > 0 ? expression : undefined;
}

/**
 * Tracks whether the default still owns the answer.
 *
 * "Only write while the answer is empty" is the obvious rule and it is wrong: a
 * default computing a legitimate `0` or `false` would freeze itself on the first pass,
 * never updating again. Remembering what the rule last wrote lets a default keep
 * tracking its dependencies while nobody else has touched the answer, and stop the
 * moment a respondent types over it.
 */
interface DefaultOwnership {
  mayWrite: (current: unknown) => boolean;
  claim: (value: unknown) => void;
  release: () => void;
}

function createDefaultOwnership(): DefaultOwnership {
  let owned = false;
  let lastWritten: unknown;

  return {
    mayWrite: (current) => isEmptyValue(current) || (owned && Object.is(current, lastWritten)),
    claim: (value) => {
      owned = true;
      lastWritten = value;
    },
    release: () => {
      owned = false;
      lastWritten = undefined;
    },
  };
}

/**
 * Applies a question's value rules in a fixed precedence.
 *
 * Precedence is defined here rather than left to graph ordering because all three
 * rules target the same answer, and "whichever the sort happened to pick" is not a
 * behaviour anyone could rely on:
 *
 * 1. **resetValueIf** wins outright. It means "this answer no longer applies", so it
 *    must not be immediately re-populated by a default — which would also make the two
 *    rules fight until the cascade limit stopped them.
 * 2. **setValueIf + setValueExpression** forces a value while its condition holds.
 * 3. **defaultValueExpression** supplies a value while the answer is empty or still
 *    the one this rule last wrote, so it tracks its dependencies but never overwrites
 *    what the respondent typed.
 *
 * A rule whose expression is malformed does nothing at all. Writing a wrong answer
 * into someone's response is worse than writing none.
 */
function applyValueRule(
  expressions: ValueRuleExpressions,
  target: ValueRuleTarget,
  context: RuleContext,
  ownership: DefaultOwnership,
): void {
  const reset = present(expressions.resetValueIf);
  if (reset !== undefined) {
    const evaluation = context.evaluate(reset);
    if (evaluation.errors.length === 0 && isTruthy(evaluation.value)) {
      target.clearValue();
      ownership.release();
      return;
    }
  }

  const setIf = present(expressions.setValueIf);
  const setExpression = present(expressions.setValueExpression);
  if (setIf !== undefined && setExpression !== undefined) {
    const condition = context.evaluate(setIf);
    if (condition.errors.length === 0 && isTruthy(condition.value)) {
      const next = context.evaluate(setExpression);
      if (next.errors.length === 0) {
        target.setValue(next.value);
        ownership.claim(next.value);
      }
      return;
    }
  }

  const defaultExpression = present(expressions.defaultValueExpression);
  if (defaultExpression !== undefined && ownership.mayWrite(target.getValue())) {
    const next = context.evaluate(defaultExpression);
    if (next.errors.length === 0) {
      target.setValue(next.value);
      ownership.claim(next.value);
    }
  }
}

function collectReads(expressions: ValueRuleExpressions): readonly DependencyPattern[] {
  const seen = new Set<string>();
  const reads: DependencyPattern[] = [];

  for (const expression of Object.values(expressions)) {
    const source = present(expression);
    if (source === undefined) {
      continue;
    }
    for (const path of collectReferences(parseExpression(source).node)) {
      const key = formatPattern(path);
      if (!seen.has(key)) {
        seen.add(key);
        reads.push(path);
      }
    }
  }
  return reads;
}

/**
 * Builds the single rule that owns a question's answer, or nothing when the question
 * declares no value-writing expressions.
 *
 * One rule per question rather than one per expression: they all write the same path,
 * so a single node gives the graph one write to order around and gives the precedence
 * above somewhere unambiguous to live.
 *
 * The question's own value is deliberately **not** declared as a read, even though
 * `defaultValueExpression` consults it. That check is an implementation detail, not a
 * dependency — declaring it would make every defaulted question a self-cycle. An
 * expression that genuinely references its own question still is one, and is reported.
 */
export function createValueRule(
  key: string,
  expressions: ValueRuleExpressions,
  target: ValueRuleTarget,
): LogicRule | undefined {
  const reads = collectReads(expressions);
  const hasRule =
    present(expressions.resetValueIf) !== undefined ||
    present(expressions.defaultValueExpression) !== undefined ||
    (present(expressions.setValueIf) !== undefined &&
      present(expressions.setValueExpression) !== undefined);

  if (!hasRule) {
    return undefined;
  }

  const ownership = createDefaultOwnership();
  return {
    key,
    reads,
    writes: target.path,
    run: (context) => {
      applyValueRule(expressions, target, context, ownership);
    },
  };
}
