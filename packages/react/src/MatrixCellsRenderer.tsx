import { MatrixCellsBase } from '@kajay/core';
import type { Question, Survey as SurveyModel } from '@kajay/core';
import type { ReactElement } from 'react';
import { MatrixCell } from './MatrixCell.js';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { QuestionErrors } from './QuestionErrors.js';
import { QuestionTitleContent } from './QuestionTitleContent.js';
import { readOnlyGroup } from './readOnly.js';
import { useSurveyValue } from './useSurveyState.js';
import { questionErrorId } from './questionId.js';

interface MatrixBodyProps {
  readonly survey: SurveyModel;
  readonly question: MatrixCellsBase;
  readonly columns: readonly Question[];
}

function MatrixBody({ survey, question, columns }: MatrixBodyProps): ReactElement {
  return (
    <tbody>
      {question.visibleRowKeys.map((rowKey) => (
        <tr className="kajay-matrix__row" key={rowKey} data-row-name={rowKey}>
          <th className="kajay-matrix__row-title" scope="row">
            {question.rowTitle(rowKey)}
          </th>
          {columns.map((column) => (
            <td className="kajay-matrix__cell" key={column.name} data-column-name={column.name}>
              <MatrixCell survey={survey} cell={question.cellAt(rowKey, column.name)} />
            </td>
          ))}
        </tr>
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

/**
 * A table whose cells are questions — checklist F2.
 *
 * The renderer draws the frame and nothing else: which control a cell shows, what it
 * accepts and what it objects to are the cell question's own business, exactly as they
 * would be on a page.
 */
export function MatrixCellsRenderer({ survey, question }: QuestionRendererProps): ReactElement {
  useSurveyValue(survey, question.name);

  if (!(question instanceof MatrixCellsBase)) {
    return <div className="kajay-question kajay-question--unsupported" />;
  }

  const errorId = questionErrorId(question);
  // Only what the matrix earned as a whole: a cell's own message is drawn by the cell.
  const own = question.errors.filter((error) => error.path === undefined);
  const columns = question.columns.filter((column) => question.isColumnVisible(column.name));

  return (
    <fieldset
      className="kajay-question kajay-question--matrix-cells"
      data-question-name={question.name}
      disabled={!question.isEnabled}
      aria-required={question.isRequired}
      {...readOnlyGroup(question.isReadOnly)}
    >
      <legend className="kajay-question__title">
        <QuestionTitleContent question={question} />
      </legend>

      <QuestionErrors survey={survey} question={question} at="top" id={errorId} errors={own} />

      <table className="kajay-matrix kajay-matrix--cells">
        <thead>
          <tr>
            <td className="kajay-matrix__corner" />
            {columns.map((column) => (
              <th className="kajay-matrix__column-title" scope="col" key={column.name}>
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <MatrixBody survey={survey} question={question} columns={columns} />
        <MatrixTotals question={question} columns={columns} />
      </table>

      <QuestionErrors survey={survey} question={question} at="bottom" id={errorId} errors={own} />
    </fieldset>
  );
}
