import { MatrixDynamicQuestion } from '@kajay/core';
import type { Question, Survey as SurveyModel } from '@kajay/core';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { MatrixCell } from './MatrixCell.js';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { QuestionErrors } from './QuestionErrors.js';
import { questionErrorId, questionId } from './questionId.js';
import { QuestionTitleContent } from './QuestionTitleContent.js';
import { readOnlyGroup, whenEditable } from './readOnly.js';
import { useSurveyValue } from './useSurveyState.js';

interface RemoveButtonProps {
  readonly question: MatrixDynamicQuestion;
  readonly rowKey: string;
}

/**
 * Removes a row, asking first when the definition says to.
 *
 * The question is asked inline rather than with `confirm()`: a native dialog stops the
 * page, cannot be styled or translated, and is the one control a respondent using a
 * screen reader is most likely to lose their place in. Two states of one button say the
 * same thing and stay inside the page.
 */
function RemoveButton({ question, rowKey }: RemoveButtonProps): ReactElement {
  const [isAsking, setAsking] = useState(false);
  const remove = (): void => {
    setAsking(false);
    question.removeRow(rowKey);
  };

  if (isAsking) {
    return (
      <span className="kajay-matrix__confirm">
        <button type="button" className="kajay-matrix__remove-confirm" onClick={remove}>
          {question.confirmDeleteText}
        </button>
        <button
          type="button"
          className="kajay-matrix__remove-cancel"
          onClick={() => {
            setAsking(false);
          }}
        >
          Keep
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className="kajay-matrix__remove"
      onClick={whenEditable(question.isReadOnly, () => {
        if (question.confirmDelete) {
          setAsking(true);
          return;
        }
        remove();
      })}
    >
      {question.removeRowText}
    </button>
  );
}

interface DynamicBodyProps {
  readonly survey: SurveyModel;
  readonly question: MatrixDynamicQuestion;
  readonly columns: readonly Question[];
}

function DynamicBody({ survey, question, columns }: DynamicBodyProps): ReactElement {
  return (
    <tbody>
      {question.rowKeys.map((rowKey) => (
        <tr className="kajay-matrix__row" key={rowKey} data-row-name={rowKey}>
          <th className="kajay-matrix__row-title" scope="row">
            {question.rowTitle(rowKey)}
          </th>
          {columns.map((column) => (
            <td className="kajay-matrix__cell" key={column.name} data-column-name={column.name}>
              <MatrixCell survey={survey} cell={question.cellAt(rowKey, column.name)} />
            </td>
          ))}
          <td className="kajay-matrix__actions">
            {question.canRemoveRow ? <RemoveButton question={question} rowKey={rowKey} /> : null}
          </td>
        </tr>
      ))}
    </tbody>
  );
}

/** The grid itself: a header row, the rows, and the totals. */
function DynamicTable({ survey, question, columns }: DynamicBodyProps): ReactElement {
  return (
    <table className="kajay-matrix kajay-matrix--dynamic" id={questionId(question)}>
      <thead>
        <tr>
          <td className="kajay-matrix__corner" />
          {columns.map((column) => (
            <th className="kajay-matrix__column-title" scope="col" key={column.name}>
              {column.title}
            </th>
          ))}
          {/* Heads the remove buttons. Empty: the buttons name themselves. */}
          <td className="kajay-matrix__corner" />
        </tr>
      </thead>
      <DynamicBody survey={survey} question={question} columns={columns} />
      <DynamicTotals question={question} columns={columns} />
    </table>
  );
}

/**
 * A table whose rows the respondent adds — checklist F3.
 *
 * The same cells as F2's fixed table, from the same base class: what differs is that the
 * rows are the answer rather than the definition, so this renderer adds the two controls
 * that create and destroy them and nothing else.
 */
export function MatrixDynamicRenderer({ survey, question }: QuestionRendererProps): ReactElement {
  useSurveyValue(survey, question.name);

  if (!(question instanceof MatrixDynamicQuestion)) {
    return <div className="kajay-question kajay-question--unsupported" />;
  }

  const errorId = questionErrorId(question);
  const own = question.errors.filter((error) => error.path === undefined);
  const columns = question.columns.filter((column) => question.isColumnVisible(column.name));

  return (
    <fieldset
      className="kajay-question kajay-question--matrix-dynamic"
      data-question-name={question.name}
      disabled={!question.isEnabled}
      aria-required={question.isRequired}
      {...readOnlyGroup(question.isReadOnly)}
    >
      <legend className="kajay-question__title">
        <QuestionTitleContent question={question} />
      </legend>

      <QuestionErrors survey={survey} question={question} at="top" id={errorId} errors={own} />

      <DynamicTable survey={survey} question={question} columns={columns} />

      {question.canAddRow ? (
        <button
          type="button"
          className="kajay-matrix__add"
          onClick={whenEditable(question.isReadOnly, () => {
            question.addRow();
          })}
        >
          {question.addRowText}
        </button>
      ) : null}

      <QuestionErrors survey={survey} question={question} at="bottom" id={errorId} errors={own} />
    </fieldset>
  );
}

/** The totals row. Its own component so the table body stays one thing to read. */
function DynamicTotals({
  question,
  columns,
}: {
  readonly question: MatrixDynamicQuestion;
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
        <td />
      </tr>
    </tfoot>
  );
}
