import { PanelDynamicQuestion } from '@kajay/core';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { MatrixFrame } from './MatrixFrame.js';
import { PanelInstance } from './PanelInstance.js';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { questionId } from './questionId.js';
import { whenEditable } from './readOnly.js';
import { useSurveyValue } from './useSurveyState.js';

interface PanelNavProps {
  readonly question: PanelDynamicQuestion;
  readonly onMove: () => void;
}

/**
 * Moving between instances when they are shown one at a time — checklist G2.
 *
 * `tab` gives a button per instance and `progress` a pair of arrows with a position; both
 * are the same model state, because which one an author picks is a question about how
 * many instances there will be rather than about what moving means.
 */
function PanelNav({ question, onMove }: PanelNavProps): ReactElement | null {
  if (!question.isPaged) {
    return null;
  }
  const move = (index: number): void => {
    question.setCurrentIndex(index);
    onMove();
  };

  return question.renderMode === 'tab' ? (
    <PanelTabs question={question} onMove={move} />
  ) : (
    <PanelSteps question={question} onMove={move} />
  );
}

/** One button per instance, for a handful of them. */
function PanelTabs({
  question,
  onMove,
}: {
  readonly question: PanelDynamicQuestion;
  readonly onMove: (index: number) => void;
}): ReactElement {
  return (
    <div className="kajay-paneldynamic__tabs" role="tablist">
      {question.rowKeys.map((rowKey, index) => (
        <button
          key={rowKey}
          type="button"
          role="tab"
          className="kajay-paneldynamic__tab"
          aria-selected={index === question.currentIndex}
          onClick={() => {
            onMove(index);
          }}
        >
          {question.rowTitle(rowKey)}
        </button>
      ))}
    </div>
  );
}

/** Arrows and a position, for however many there turn out to be. */
function PanelSteps({
  question,
  onMove,
}: {
  readonly question: PanelDynamicQuestion;
  readonly onMove: (index: number) => void;
}): ReactElement {
  return (
    <div className="kajay-paneldynamic__progress">
      <button
        type="button"
        className="kajay-paneldynamic__previous"
        disabled={question.currentIndex === 0}
        onClick={() => {
          onMove(question.currentIndex - 1);
        }}
      >
        Previous
      </button>
      <span className="kajay-paneldynamic__position">
        {`${String(question.currentIndex + 1)} of ${String(question.panelCount)}`}
      </span>
      <button
        type="button"
        className="kajay-paneldynamic__next"
        disabled={question.currentIndex >= question.panelCount - 1}
        onClick={() => {
          onMove(question.currentIndex + 1);
        }}
      >
        Next
      </button>
    </div>
  );
}

/** The control that creates an instance. Absent, not disabled, once the ceiling is hit. */
function AddPanelButton({
  question,
  onAdd,
}: {
  readonly question: PanelDynamicQuestion;
  readonly onAdd: () => void;
}): ReactElement | null {
  if (!question.canAddPanel) {
    return null;
  }
  return (
    <button
      type="button"
      className="kajay-paneldynamic__add"
      onClick={whenEditable(question.isReadOnly, () => {
        question.addPanel();
        onAdd();
      })}
    >
      {question.addPanelText}
    </button>
  );
}

/**
 * A group of questions repeated for each of several things — checklist G1.
 *
 * The same instances a matrix draws as table rows, drawn as stacked groups instead. The
 * renderer owns nothing but that arrangement: what is in an instance, what it accepts and
 * what it objects to belong to the questions inside it.
 */
export function PanelDynamicRenderer({ survey, question }: QuestionRendererProps): ReactElement {
  useSurveyValue(survey, question.name);
  // Which instance is on screen is a fact about this view, not an answer, so nothing on
  // the survey's event channel carries it and the component that moved redraws itself.
  const [, setViewVersion] = useState(0);
  const redraw = (): void => {
    setViewVersion((version) => version + 1);
  };

  if (!(question instanceof PanelDynamicQuestion)) {
    return <div className="kajay-question kajay-question--unsupported" />;
  }

  return (
    <MatrixFrame survey={survey} question={question} className="kajay-question--paneldynamic">
      <PanelNav question={question} onMove={redraw} />
      <div className="kajay-paneldynamic" id={questionId(question)}>
        {question.visiblePanelKeys.map((rowKey) => (
          <PanelInstance
            key={rowKey}
            survey={survey}
            question={question}
            rowKey={rowKey}
            onRemove={redraw}
          />
        ))}
      </div>
      <AddPanelButton question={question} onAdd={redraw} />
    </MatrixFrame>
  );
}
