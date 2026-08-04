import type { MatrixCellsBase, Survey as SurveyModel } from '@kajay/core';
import type { ReactElement } from 'react';
import { MatrixCell } from './MatrixCell.js';
import { questionId } from './questionId.js';
import { useSurveyComponents } from './SurveyComponents.js';

export interface MatrixRowDetailProps {
  readonly survey: SurveyModel;
  readonly question: MatrixCellsBase;
  readonly rowKey: string;
}

export interface MatrixDetailToggleProps {
  readonly question: MatrixCellsBase;
  readonly rowKey: string;
  /**
   * Called after the model has been told.
   *
   * Whether a detail is open is state the *model* holds — another adapter has to be able
   * to ask, and a detail opens itself when something inside it is wrong — but it is not
   * an answer and nothing in the survey depends on it, so it has no business on the
   * event channel that carries answers. The component that changed it re-renders itself.
   */
  readonly onToggle: () => void;
}

/** The id the toggle and the panel it controls agree on. */
function detailId(question: MatrixCellsBase, rowKey: string): string {
  return `${questionId(question)}-detail-${rowKey}`;
}

/**
 * The button that opens a row's detail — checklist F4.
 *
 * `aria-expanded` and `aria-controls` rather than a chevron and hope: a respondent who
 * cannot see the panel appear needs to be told that this control owns it and what state
 * it is in.
 */
export function MatrixDetailToggle({
  question,
  rowKey,
  onToggle,
}: MatrixDetailToggleProps): ReactElement {
  const { Button } = useSurveyComponents();
  const isExpanded = question.isRowExpanded(rowKey);
  return (
    <Button
      type="button"
      className="kajay-matrix__detail-toggle"
      aria-expanded={isExpanded}
      aria-controls={detailId(question, rowKey)}
      onClick={() => {
        question.setRowExpanded(rowKey, !isExpanded);
        onToggle();
      }}
    >
      {question.rowTitle(rowKey)}
    </Button>
  );
}

/** The questions under one row, drawn when it is open. */
export function MatrixRowDetail({
  survey,
  question,
  rowKey,
}: MatrixRowDetailProps): ReactElement | null {
  if (!question.isRowExpanded(rowKey)) {
    return null;
  }
  return (
    <div className="kajay-matrix__detail" id={detailId(question, rowKey)}>
      {question.detailCellsFor(rowKey).map((cell) => (
        <MatrixCell key={cell.name} survey={survey} cell={cell} />
      ))}
    </div>
  );
}
