import { collectReferences } from '../expressions/collectReferences.js';
import type { PathSegment } from '../expressions/ExpressionNode.js';
import { isEmptyValue, valuesAreEqual } from '../expressions/expressionValues.js';
import { parseExpression } from '../expressions/parseExpression.js';
import { createValueRule } from '../logic/createValueRule.js';
import { ExpressionQuestion } from './ExpressionQuestion.js';
import type { FillInTheBlankQuestion } from './FillInTheBlankQuestion.js';
import type { Question } from './Question.js';
import { stringProperty } from './registerSurveyRules.js';
import type { SurveyLogicHost } from './SurveyLogicHost.js';

/** A write that reports whether anything moved, so a rule can say what it changed. */
function writeBlank(blank: Question, value: unknown): boolean {
  if (valuesAreEqual(blank.value, value)) {
    return false;
  }
  blank.value = value;
  return true;
}

function clearBlank(blank: Question): boolean {
  if (isEmptyValue(blank.value)) {
    return false;
  }
  blank.value = undefined;
  return true;
}

/**
 * The graph rules a blank carries — checklist C13, ADR-0048.
 *
 * A blank is a question, so it may hold a `setValueIf`, a `defaultValueExpression` or a
 * computed `expression` like any other. What differs from a question on a page is only
 * *where* its answer lives, which the rule declares as its write path so anything reading
 * the blank is still ordered after it. That is the same arrangement a matrix cell has, and
 * for the same reason.
 *
 * **Without this a computed blank silently never computed.** It parsed, it round-tripped,
 * it drew — and it stayed empty for ever, because nothing had told the graph its rule
 * existed. That is the failure this file exists to make impossible.
 *
 * **A blank's expression names the whole path**, `{plan.seats}` rather than `{seats}`. The
 * answer really does live at that path, and it is how a multiple-text field is already read
 * from anywhere else; a private scope would be a second name-resolution system bought to
 * save five characters.
 */
export function registerBlankRules(
  question: FillInTheBlankQuestion,
  owner: string,
  host: SurveyLogicHost,
): void {
  for (const blank of question.blanks) {
    registerBlankRule(
      blank,
      [
        { kind: 'name', name: question.valueKey },
        { kind: 'name', name: blank.name },
      ],
      `${owner}:blank:${blank.name}`,
      host,
    );
  }
}

function registerBlankRule(
  blank: Question,
  path: readonly PathSegment[],
  owner: string,
  host: SurveyLogicHost,
): void {
  const rule = createValueRule(
    `${owner}:value`,
    {
      resetValueIf: stringProperty(blank, 'resetValueIf'),
      setValueIf: stringProperty(blank, 'setValueIf'),
      setValueExpression: stringProperty(blank, 'setValueExpression'),
      defaultValueExpression: stringProperty(blank, 'defaultValueExpression'),
    },
    {
      path,
      getValue: () => blank.value,
      setValue: (value: unknown) => writeBlank(blank, value),
      clearValue: () => clearBlank(blank),
    },
  );
  if (rule !== undefined) {
    host.logic.addRule(rule);
  }

  const expression =
    blank instanceof ExpressionQuestion ? stringProperty(blank, 'expression') : undefined;
  if (expression === undefined) {
    return;
  }
  host.logic.addRule({
    key: `${owner}:expression`,
    reads: collectReferences(parseExpression(expression).node),
    writes: path,
    run: (context) => {
      const evaluation = context.evaluate(expression);
      // A malformed expression writes nothing, exactly as on a page: a wrong number in
      // someone's response is worse than a blank one.
      if (evaluation.errors.length > 0) {
        return [];
      }
      return writeBlank(blank, evaluation.value) ? [path] : [];
    },
  });
}
