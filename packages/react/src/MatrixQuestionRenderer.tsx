import { MatrixQuestion, matrixRowKey } from '@kajay/core';
import type { ItemValue, SurveyError } from '@kajay/core';
import type { ReactElement } from 'react';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { MatrixFrame } from './MatrixFrame.js';
import { whenEditable } from './readOnly.js';
import { useMatrixLayout } from './useMatrixLayout.js';
import { useSurveyValue } from './useSurveyState.js';
import { questionId } from './questionId.js';

interface MatrixRowProps {
  readonly question: MatrixQuestion;
  readonly row: ItemValue;
  readonly rowId: string;
  readonly columnId: (index: number) => string;
  readonly errors: readonly SurveyError[];
}

/**
 * One row: its label, then a radio per column.
 *
 * Each input is labelled by the row header *and* its column header rather than by text
 * of its own, so a screen reader announces "Documentation, Second" — which is the whole
 * question being asked in that cell. A grid of radios with nothing but a position is the
 * classic way a matrix becomes unanswerable without sight, and it is invisible from the
 * model, which is why this is proven in a browser rather than a unit test.
 */
function MatrixRow({ question, row, rowId, columnId, errors }: MatrixRowProps): ReactElement {
  const errorId = `${rowId}-errors`;
  const hasErrors = errors.length > 0;

  return (
    <tr className="kajay-matrix__row" data-row-name={matrixRowKey(row)}>
      <th className="kajay-matrix__row-title" scope="row">
        {/* The label is the title and nothing else. With the message inside this span
            every cell in a failing row would announce it as part of its own name — and
            then again as its description. */}
        <span id={rowId}>{row.text}</span>
        {hasErrors ? (
          <div className="kajay-question__errors" id={errorId} role="alert">
            {errors.map((error) => (
              <p key={`${error.kind}:${error.text}`} className="kajay-question__error">
                {error.text}
              </p>
            ))}
          </div>
        ) : null}
      </th>
      {question.visibleColumns.map((column, index) => (
        <td className="kajay-matrix__cell" key={String(column.value)}>
          <input
            type="radio"
            name={rowId}
            value={String(column.value)}
            checked={question.isSelected(row, column)}
            aria-labelledby={`${rowId} ${columnId(index)}`}
            aria-invalid={hasErrors || undefined}
            aria-describedby={hasErrors ? errorId : undefined}
            onChange={whenEditable(question.isReadOnly, () => {
              question.setRowValue(row, column.value);
            })}
          />
        </td>
      ))}
    </tr>
  );
}

interface MatrixTableProps {
  readonly question: MatrixQuestion;
  readonly base: string;
  readonly columnId: (index: number) => string;
}

/** The grid itself: one header row naming the scale, then a row per subject. */
function MatrixTable({ question, base, columnId }: MatrixTableProps): ReactElement {
  return (
    <table
      className={question.alternateRows ? 'kajay-matrix kajay-matrix--alternate' : 'kajay-matrix'}
    >
      <thead>
        <tr>
          {/* Empty by design: the corner heads the row titles, which name themselves. */}
          <td className="kajay-matrix__corner" />
          {question.visibleColumns.map((column, index) => (
            <th
              className="kajay-matrix__column-title"
              scope="col"
              id={columnId(index)}
              key={String(column.value)}
            >
              {column.text}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {question.visibleRows.map((row, index) => (
          <MatrixRow
            key={matrixRowKey(row)}
            question={question}
            row={row}
            rowId={`${base}-row-${String(index)}`}
            columnId={columnId}
            errors={question.errors.filter((error) => error.path === matrixRowKey(row))}
          />
        ))}
      </tbody>
    </table>
  );
}

/**
 * One row as its own radio group — the narrow-screen layout, checklist F6.
 *
 * A single-select matrix is the type most likely to be answered on a phone, and as a
 * table it is the worst offender: five columns of radio buttons in 375 pixels is a row
 * of unlabelled dots. As a list each row is a group with its own legend and each option
 * carries its text, which is the same question asked in a shape that fits.
 */
function MatrixRadioList({ question }: { readonly question: MatrixQuestion }): ReactElement {
  return (
    <div className="kajay-matrix-list">
      {question.visibleRows.map((row) => (
        <fieldset
          className="kajay-matrix-list__row"
          key={matrixRowKey(row)}
          data-row-name={matrixRowKey(row)}
        >
          <legend className="kajay-matrix-list__row-title">{row.text}</legend>
          {question.errors
            .filter((error) => error.path === matrixRowKey(row))
            .map((error) => (
              <p className="kajay-question__error" key={error.kind} role="alert">
                {error.text}
              </p>
            ))}
          {question.visibleColumns.map((column) => (
            <label className="kajay-choice" key={String(column.value)}>
              <input
                type="radio"
                name={`${matrixRowKey(row)}-list`}
                value={String(column.value)}
                checked={question.isSelected(row, column)}
                onChange={whenEditable(question.isReadOnly, () => {
                  question.setRowValue(row, column.value);
                })}
              />
              <span>{column.text}</span>
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}

/**
 * One question asked of several rows — checklist F1.
 *
 * A real table, because that is what it is: the column headers name the scale once and
 * the row headers name each subject, and both are announced with the cell. Rendering it
 * as nested lists of radios would look identical and say nothing.
 */
export function MatrixQuestionRenderer({ survey, question }: QuestionRendererProps): ReactElement {
  useSurveyValue(survey, question.name);
  const layout = useMatrixLayout(
    question instanceof MatrixQuestion ? question.mobileMode : 'table',
  );

  if (!(question instanceof MatrixQuestion)) {
    return <div className="kajay-question kajay-question--unsupported" />;
  }

  const base = questionId(question);
  const columnId = (index: number): string => `${base}-column-${String(index)}`;

  return (
    <MatrixFrame survey={survey} question={question} className="kajay-question--matrix">
      {layout === 'list' ? (
        <MatrixRadioList question={question} />
      ) : (
        <MatrixTable question={question} base={base} columnId={columnId} />
      )}
    </MatrixFrame>
  );
}
