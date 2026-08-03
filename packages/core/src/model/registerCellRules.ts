import { collectReferences } from '../expressions/collectReferences.js';
import type { PathSegment } from '../expressions/ExpressionNode.js';
import { isEmptyValue, valuesAreEqual } from '../expressions/expressionValues.js';
import { parseExpression } from '../expressions/parseExpression.js';
import { createValueRule } from '../logic/createValueRule.js';
import { ExpressionQuestion } from './ExpressionQuestion.js';
import type { MatrixCellsBase } from './MatrixCellsBase.js';
import type { Question } from './Question.js';
import type { RuleHost } from './registerSurveyRules.js';
import { stringProperty } from './registerSurveyRules.js';

/**
 * Writes a cell's answer and says whether anything changed.
 *
 * The comparison is here rather than left to the value host because a rule has to report
 * whether it wrote: the transaction uses that to decide what to re-evaluate, and a rule
 * that claimed a write on every pass would cascade until the fuel ran out.
 */
function writeCell(cell: Question, value: unknown): boolean {
  if (valuesAreEqual(cell.value, value)) {
    return false;
  }
  cell.value = value;
  return true;
}

/** Clearing is writing nothing at all, which for an answer is what emptiness means. */
function clearCell(cell: Question): boolean {
  if (isEmptyValue(cell.value)) {
    return false;
  }
  cell.value = undefined;
  return true;
}

/**
 * Registers the rules a single cell brings with it.
 *
 * A cell is a question, so it may carry everything a question carries: a
 * `defaultValueExpression`, a `setValueIf`, a computed `expression`. Those are ordinary
 * graph rules — the only thing that differs from a question on a page is *where* the
 * answer lives, which the rule declares as its write path so anything reading the cell
 * is still ordered after it.
 *
 * The expressions themselves were rewritten into the row's scope when the cell was
 * built, so by the time they get here `{row.price}` is already `{basket[0].price}` and
 * the graph can read the dependency straight out of the text.
 */
function registerCellRule(
  cell: Question,
  path: readonly PathSegment[],
  owner: string,
  host: RuleHost,
): void {
  const target = {
    path,
    getValue: () => cell.value,
    setValue: (value: unknown) => writeCell(cell, value),
    clearValue: () => clearCell(cell),
  };
  const rule = createValueRule(
    `${owner}:value`,
    {
      resetValueIf: stringProperty(cell, 'resetValueIf'),
      setValueIf: stringProperty(cell, 'setValueIf'),
      setValueExpression: stringProperty(cell, 'setValueExpression'),
      defaultValueExpression: stringProperty(cell, 'defaultValueExpression'),
    },
    target,
  );
  if (rule !== undefined) {
    host.logic.addRule(rule);
  }

  const expression =
    cell instanceof ExpressionQuestion ? stringProperty(cell, 'expression') : undefined;
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
      return writeCell(cell, evaluation.value) ? [path] : [];
    },
  });
}

/** Every cell of every row. Re-run whenever the rows change, like any other rule. */
export function registerCellRules(matrix: MatrixCellsBase, owner: string, host: RuleHost): void {
  for (const rowKey of matrix.rowKeys) {
    for (const cell of matrix.rowCells(rowKey)) {
      registerCellRule(
        cell,
        matrix.cellPath(rowKey, cell.name),
        `${owner}:cell:${rowKey}:${cell.name}`,
        host,
      );
    }
  }
}
