import type { Question } from '@kajay/core';

/**
 * The DOM id prefix for one question, and the radio-group name that goes with it.
 *
 * Built from `instanceKey` rather than `name`, because a matrix column's cells all carry
 * the column's name: ids built from the name alone repeat across rows, and a browser
 * resolves a repeated id by pointing every label at the first element that has it. The
 * symptom is a label in row two that focuses — and writes into — row one.
 *
 * `instanceKey` answers "which cell in which row"; it cannot answer "which of the two
 * surveys on this page", because it is unique *within* a survey. That is what `scope` is
 * for — see [`idScope`](./idScope.ts), and §P7 for the defect that produced it. Defaulted
 * to empty so a renderer outside a `<Survey>` keeps the ids it always had.
 *
 * One helper rather than the same template string in a dozen renderers, so a new one
 * cannot get it wrong and the rule has somewhere to be explained.
 */
export function questionId(question: Question, scope = ''): string {
  return `${scope}kajay-question-${question.instanceKey}`;
}

/** The id of a question's error block, which its input points at with `aria-describedby`. */
export function questionErrorId(question: Question, scope = ''): string {
  return `${questionId(question, scope)}-errors`;
}
