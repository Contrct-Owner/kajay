import type { Survey as SurveyModel } from '@kajay/core';
import type { FormEvent, ReactElement } from 'react';
import { defaultQuestionRenderers } from './defaultQuestionRenderers.js';
import type { QuestionRendererRegistry } from './QuestionRendererRegistry.js';
import { useSurveyCompleted } from './useSurveyState.js';

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

      {model.pages.map((page) => (
        <section
          className="kajay-page"
          key={page.name}
          aria-label={page.title.length > 0 ? page.title : page.name}
        >
          {page.title.length > 0 ? <h2 className="kajay-page__title">{page.title}</h2> : null}
          {page.elements.map((question) => {
            const Renderer = renderers.get(question.type);
            if (Renderer === undefined) {
              return (
                <div className="kajay-question kajay-question--unsupported" key={question.name}>
                  {`No renderer is registered for question type "${question.type}".`}
                </div>
              );
            }
            return <Renderer key={question.name} survey={model} question={question} />;
          })}
        </section>
      ))}

      <button className="kajay-survey__complete" type="submit">
        Complete
      </button>
    </form>
  );
}
