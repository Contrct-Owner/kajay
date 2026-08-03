import type { MatrixCellsBase, Question, Survey as SurveyModel } from '@kajay/core';
import type { ReactElement, ReactNode } from 'react';
import { MatrixCell } from './MatrixCell.js';
import { MatrixRowDetail } from './MatrixRowDetail.js';

export interface MatrixRowListProps {
  readonly survey: SurveyModel;
  readonly question: MatrixCellsBase;
  readonly columns: readonly Question[];
  readonly rowKeys: readonly string[];
  /** Drawn at the end of each row — the remove button of a dynamic matrix. */
  readonly rowActions?: (rowKey: string) => ReactNode;
}

/**
 * A matrix drawn as a list of rows rather than as a table — checklist F6.
 *
 * On a narrow screen a table is either a horizontal scroll or a column of overlapping
 * text, and neither is answerable. Each row becomes a group of its own with the row
 * title as its legend, and the cells keep the labels they already have — which is why
 * a cell is titled for its row *and* its column: the same title works read out under a
 * legend and hidden behind a column header.
 *
 * A real structural change rather than a class name, because this library ships no
 * stylesheet: a hook a theme might use would be a feature nobody could see.
 */
export function MatrixRowList({
  survey,
  question,
  columns,
  rowKeys,
  rowActions,
}: MatrixRowListProps): ReactElement {
  return (
    <div className="kajay-matrix-list">
      {rowKeys.map((rowKey) => (
        <fieldset className="kajay-matrix-list__row" key={rowKey} data-row-name={rowKey}>
          <legend className="kajay-matrix-list__row-title">{question.rowTitle(rowKey)}</legend>
          {columns.map((column) => (
            <MatrixCell
              key={column.name}
              survey={survey}
              cell={question.cellAt(rowKey, column.name)}
            />
          ))}
          <MatrixRowDetail survey={survey} question={question} rowKey={rowKey} />
          {rowActions?.(rowKey)}
        </fieldset>
      ))}
    </div>
  );
}
