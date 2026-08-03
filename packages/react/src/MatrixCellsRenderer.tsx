import { MatrixCellsBase } from '@kajay/core';
import type { Question, Survey as SurveyModel } from '@kajay/core';
import { Fragment, useState } from 'react';
import type { ReactElement } from 'react';
import { MatrixCell } from './MatrixCell.js';
import { MatrixDetailToggle, MatrixRowDetail } from './MatrixRowDetail.js';
import { MatrixRowList } from './MatrixRowList.js';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { MatrixFrame } from './MatrixFrame.js';
import { useMatrixLayout } from './useMatrixLayout.js';
import { useSurveyValue } from './useSurveyState.js';

interface MatrixBodyProps {
  readonly survey: SurveyModel;
  readonly question: MatrixCellsBase;
  readonly columns: readonly Question[];
  readonly onToggleDetail: () => void;
}

function MatrixBody({
  survey,
  question,
  columns,
  onToggleDetail,
}: MatrixBodyProps): ReactElement {
  return (
    <tbody>
      {question.visibleRowKeys.map((rowKey) => (
        <Fragment key={rowKey}>
          <tr className="kajay-matrix__row" data-row-name={rowKey}>
            <th className="kajay-matrix__row-title" scope="row">
              {question.hasDetailPanel ? (
                <MatrixDetailToggle
                  question={question}
                  rowKey={rowKey}
                  onToggle={onToggleDetail}
                />
              ) : (
                question.rowTitle(rowKey)
              )}
            </th>
            {columns.map((column) => (
              <td className="kajay-matrix__cell" key={column.name} data-column-name={column.name}>
                <MatrixCell survey={survey} cell={question.cellAt(rowKey, column.name)} />
              </td>
            ))}
          </tr>
          {question.isRowExpanded(rowKey) ? (
            <tr className="kajay-matrix__detail-row">
              {/* One cell across the whole width: the detail is about the row, not
                  about any column in it. */}
              <td colSpan={columns.length + 1}>
                <MatrixRowDetail survey={survey} question={question} rowKey={rowKey} />
              </td>
            </tr>
          ) : null}
        </Fragment>
      ))}
    </tbody>
  );
}

/** The totals row, drawn only when some column has one. */
function MatrixTotals({
  question,
  columns,
}: {
  readonly question: MatrixCellsBase;
  readonly columns: readonly Question[];
}): ReactElement | null {
  const texts = columns.map((column) => question.totalText(column.name));
  if (texts.every((text) => text.length === 0)) {
    return null;
  }
  return (
    <tfoot>
      <tr className="kajay-matrix__totals">
        <th scope="row" className="kajay-matrix__row-title">
          Total
        </th>
        {columns.map((column, index) => (
          <td className="kajay-matrix__total" key={column.name} data-total-for={column.name}>
            {texts[index]}
          </td>
        ))}
      </tr>
    </tfoot>
  );
}

/** The grid itself: one header row naming the scale, then a row per subject. */
function CellsTable({
  survey,
  question,
  columns,
  onToggleDetail,
}: MatrixBodyProps): ReactElement {
  return (
    <table className="kajay-matrix kajay-matrix--cells">
      <thead>
        <tr>
          {/* Empty by design: the corner heads the row titles, which name themselves. */}
          <td className="kajay-matrix__corner" />
          {columns.map((column) => (
            <th className="kajay-matrix__column-title" scope="col" key={column.name}>
              {column.title}
            </th>
          ))}
        </tr>
      </thead>
      <MatrixBody
        survey={survey}
        question={question}
        columns={columns}
        onToggleDetail={onToggleDetail}
      />
      <MatrixTotals question={question} columns={columns} />
    </table>
  );
}

/**
 * A table whose cells are questions — checklist F2.
 *
 * The renderer draws the frame and nothing else: which control a cell shows, what it
 * accepts and what it objects to are the cell question's own business, exactly as they
 * would be on a page.
 */
export function MatrixCellsRenderer({ survey, question }: QuestionRendererProps): ReactElement {
  useSurveyValue(survey, question.name);
  const layout = useMatrixLayout(
    question instanceof MatrixCellsBase ? question.mobileMode : 'table',
  );
  // Opening a detail changes nothing a survey event carries, so the component that
  // made the change is the one that has to notice it.
  const [, setDetailVersion] = useState(0);
  const redraw = (): void => {
    setDetailVersion((version) => version + 1);
  };

  if (!(question instanceof MatrixCellsBase)) {
    return <div className="kajay-question kajay-question--unsupported" />;
  }

  const columns = question.columns.filter((column) => question.isColumnVisible(column.name));

  return (
    <MatrixFrame survey={survey} question={question} className="kajay-question--matrix-cells">
      {layout === 'list' ? (
        <MatrixRowList
          survey={survey}
          question={question}
          columns={columns}
          rowKeys={question.visibleRowKeys}
        />
      ) : (
        <CellsTable
          survey={survey}
          question={question}
          columns={columns}
          onToggleDetail={redraw}
        />
      )}
    </MatrixFrame>
  );
}
