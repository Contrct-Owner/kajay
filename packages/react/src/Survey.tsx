import type { Survey as SurveyModel } from '@kajay/core';
import type { FormEvent, ReactElement } from 'react';
import { defaultQuestionRenderers } from './defaultQuestionRenderers.js';
import type { QuestionRendererRegistry } from './QuestionRendererRegistry.js';
import { SurveyNavigation } from './SurveyNavigation.js';
import { SurveyPage } from './SurveyPage.js';
import {
  useSurveyCompleted,
  useSurveyCurrentPageNo,
  useSurveyLogicState,
} from './useSurveyState.js';

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
  // And again for navigation, which moves for reasons logic knows nothing about.
  useSurveyCurrentPageNo(model);

  if (isCompleted) {
    return (
      <div className="kajay-survey kajay-survey--completed" role="status">
        <p className="kajay-survey__completed-text">Thank you for completing this survey.</p>
      </div>
    );
  }

  // Submitting means "advance", which on the last page means complete. Keeping that
  // decision in the model stops each adapter reinventing "am I at the end".
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    model.nextPageOrComplete();
  };

  const currentPage = model.currentPage;

  return (
    <form className="kajay-survey" onSubmit={handleSubmit} noValidate>
      {model.title.length > 0 ? <h1 className="kajay-survey__title">{model.title}</h1> : null}
      {model.description.length > 0 ? (
        <p className="kajay-survey__description">{model.description}</p>
      ) : null}

      {currentPage === undefined ? null : (
        <SurveyPage
          key={currentPage.name}
          survey={model}
          page={currentPage}
          renderers={renderers}
        />
      )}

      <SurveyNavigation survey={model} />
    </form>
  );
}
