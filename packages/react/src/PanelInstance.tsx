import type { PageElement, PanelDynamicQuestion, Survey as SurveyModel } from '@kajay/core';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { useQuestionRenderers } from './QuestionRenderersContext.js';
import { whenEditable } from './readOnly.js';

export interface PanelInstanceProps {
  readonly survey: SurveyModel;
  readonly question: PanelDynamicQuestion;
  readonly rowKey: string;
  readonly onRemove: () => void;
}

/**
 * One element of a template instance: a question, or a panel holding more of them.
 *
 * Recursive, because G4's nesting is not a feature so much as the absence of a
 * restriction: a panel in a template is a panel like any other, and a matrix in one
 * builds its own cells from the attachment it was handed when it was copied.
 */
function InstanceElement({
  survey,
  element,
}: {
  readonly survey: SurveyModel;
  readonly element: PageElement;
}): ReactElement | null {
  const renderers = useQuestionRenderers();
  if (!element.isVisible) {
    return null;
  }
  return renderers.render(survey, element);
}

/**
 * Removes an instance, asking first when the definition says to.
 *
 * Inline rather than `confirm()`, on the same reasoning as a dynamic matrix row — and
 * with more force here, because a panel can hold a page of typing.
 */
function RemovePanelButton({
  question,
  rowKey,
  onRemove,
}: {
  readonly question: PanelDynamicQuestion;
  readonly rowKey: string;
  readonly onRemove: () => void;
}): ReactElement {
  const [isAsking, setAsking] = useState(false);
  const remove = (): void => {
    setAsking(false);
    question.removePanel(rowKey);
    onRemove();
  };

  if (isAsking) {
    return (
      <ConfirmRemoval
        text={question.confirmDeleteText}
        onConfirm={remove}
        onCancel={() => {
          setAsking(false);
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="kajay-paneldynamic__remove"
      onClick={whenEditable(question.isReadOnly, () => {
        if (question.confirmDelete) {
          setAsking(true);
          return;
        }
        remove();
      })}
    >
      {question.removePanelText}
    </button>
  );
}

/** The two-button state of a remove that asks first. */
function ConfirmRemoval({
  text,
  onConfirm,
  onCancel,
}: {
  readonly text: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}): ReactElement {
  return (
    <span className="kajay-paneldynamic__confirm">
      <button type="button" className="kajay-paneldynamic__remove-confirm" onClick={onConfirm}>
        {text}
      </button>
      <button type="button" className="kajay-paneldynamic__remove-cancel" onClick={onCancel}>
        Keep
      </button>
    </span>
  );
}

/** One instance of the template: its own group, its own questions, its own remove. */
export function PanelInstance({
  survey,
  question,
  rowKey,
  onRemove,
}: PanelInstanceProps): ReactElement {
  return (
    <fieldset className="kajay-paneldynamic__panel" data-panel-index={rowKey}>
      <legend className="kajay-paneldynamic__panel-title">{question.rowTitle(rowKey)}</legend>
      {question.elementsFor(rowKey).map((element) => (
        <InstanceElement key={element.name} survey={survey} element={element} />
      ))}
      {question.canRemovePanel ? (
        <RemovePanelButton question={question} rowKey={rowKey} onRemove={onRemove} />
      ) : null}
    </fieldset>
  );
}
