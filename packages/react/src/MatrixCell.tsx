import type { Question, Survey as SurveyModel } from '@kajay/core';
import type { ReactElement } from 'react';
import { useQuestionRenderers } from './QuestionRenderersContext.js';

export interface MatrixCellProps {
  readonly survey: SurveyModel;
  /** Undefined when the column names no cell in this row, which is an authoring slip. */
  readonly cell: Question | undefined;
}

/**
 * One cell: the column's own question type, drawn by the renderer registered for it.
 *
 * This is the whole reason cells are real questions. A `rating` in a matrix is the same
 * component as a `rating` on a page — including a host's replacement for it, which is
 * why the registry comes from context rather than from a default: a host that swapped a
 * question type would otherwise find its replacement everywhere except inside a table,
 * which is the one place the difference is hardest to notice.
 */
export function MatrixCell({ survey, cell }: MatrixCellProps): ReactElement | null {
  const renderers = useQuestionRenderers();
  if (cell === undefined || !cell.isVisible) {
    return null;
  }
  const Renderer = renderers.get(cell.type);
  if (Renderer === undefined) {
    return (
      <div className="kajay-question kajay-question--unsupported">
        {`No renderer is registered for question type "${cell.type}".`}
      </div>
    );
  }
  return <Renderer survey={survey} question={cell} />;
}
