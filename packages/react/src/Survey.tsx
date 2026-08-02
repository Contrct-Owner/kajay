import type { Survey as SurveyModel } from '@kajay/core';
import type { FormEvent, ReactElement } from 'react';
import { defaultQuestionRenderers } from './defaultQuestionRenderers.js';
import type { QuestionRendererRegistry } from './QuestionRendererRegistry.js';
import { SurveyPage } from './SurveyPage.js';
import { useSurveyCompleted, useSurveyLogicState } from './useSurveyState.js';

export interface SurveyProps {
  readonly model: SurveyModel;
  /** Defaults to the built-in renderers; pass a clone to add custom question types. */
  readonly renderers?: QuestionRendererRegistry;
}

/**
 * Mounts a survey model.
 *
 * The component holds no survey logic — it reads model state, renders, and pushes
 * every change back through the model's public API. That constraint is what keeps the
 * renderer portable to another framework by construction.
 */
export function Survey({ model, renderers = defaultQuestionRenderers }: SurveyProps): ReactElement {
  const isCompleted = useSurveyCompleted(model);
  // Subscribed for the re-render: conditional logic can add, remove or disable
  // elements between renders, and nothing else would tell React about it.
  useSurveyLogicState(model);

  if (isCompleted) {
    return (
      <div className="kajay-survey kajay-survey--completed" role="status">
        <p className="kajay-survey__completed-text">Thank you for completing this survey.</p>
      </div>
    );
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    model.complete();
  };

  return (
    <form className="kajay-survey" onSubmit={handleSubmit} noValidate>
      {model.title.length > 0 ? <h1 className="kajay-survey__title">{model.title}</h1> : null}
      {model.description.length > 0 ? (
        <p className="kajay-survey__description">{model.description}</p>
      ) : null}

      {model.visiblePages.map((page) => (
        <SurveyPage key={page.name} survey={model} page={page} renderers={renderers} />
      ))}

      <button className="kajay-survey__complete" type="submit">
        Complete
      </button>
    </form>
  );
}
