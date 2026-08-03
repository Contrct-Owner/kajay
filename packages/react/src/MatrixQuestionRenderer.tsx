import { MatrixQuestion, matrixRowKey } from '@kajay/core';
import type { ItemValue, SurveyError } from '@kajay/core';
import type { ReactElement } from 'react';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { QuestionErrors } from './QuestionErrors.js';
import { QuestionTitleContent } from './QuestionTitleContent.js';
import { readOnlyGroup, whenEditable } from './readOnly.js';
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
 * One question asked of several rows — checklist F1.
 *
 * A real table, because that is what it is: the column headers name the scale once and
 * the row headers name each subject, and both are announced with the cell. Rendering it
 * as nested lists of radios would look identical and say nothing.
 */
export function MatrixQuestionRenderer({ survey, question }: QuestionRendererProps): ReactElement {
  useSurveyValue(survey, question.name);

  if (!(question instanceof MatrixQuestion)) {
    return <div className="kajay-question kajay-question--unsupported" />;
  }

  const base = questionId(question);
  const errorId = `${base}-errors`;
  const columnId = (index: number): string => `${base}-column-${String(index)}`;
  // Only what was reported against the question as a whole: a row's own message sits
  // beside that row, and showing it in both places would say everything twice.
  const questionErrors = question.errors.filter((error) => error.path === undefined);

  return (
    <fieldset
      className="kajay-question kajay-question--matrix"
      data-question-name={question.name}
      disabled={!question.isEnabled}
      aria-required={question.isRequired}
      {...readOnlyGroup(question.isReadOnly)}
    >
      <legend className="kajay-question__title">
        <QuestionTitleContent question={question} />
      </legend>

      <QuestionErrors
        survey={survey}
        question={question}
        at="top"
        id={errorId}
        errors={questionErrors}
      />

      <MatrixTable question={question} base={base} columnId={columnId} />

      <QuestionErrors
        survey={survey}
        question={question}
        at="bottom"
        id={errorId}
        errors={questionErrors}
      />
    </fieldset>
  );
}
