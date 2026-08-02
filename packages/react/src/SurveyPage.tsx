import type { Page, Survey as SurveyModel } from '@kajay/core';
import type { ReactElement } from 'react';
import type { QuestionRendererRegistry } from './QuestionRendererRegistry.js';

export interface SurveyPageProps {
  readonly survey: SurveyModel;
  readonly page: Page;
  readonly renderers: QuestionRendererRegistry;
}

/**
 * Draws one page's visible elements.
 *
 * Internal to the package: the public surface is `<Survey model={...} />`, and a host
 * customises rendering by registering renderers rather than by composing internals.
 */
export function SurveyPage({ survey, page, renderers }: SurveyPageProps): ReactElement {
  return (
    <section className="kajay-page" aria-label={page.title.length > 0 ? page.title : page.name}>
      {page.title.length > 0 ? <h2 className="kajay-page__title">{page.title}</h2> : null}
      {page.visibleElements.map((question) => {
        const Renderer = renderers.get(question.type);
        if (Renderer === undefined) {
          return (
            <div className="kajay-question kajay-question--unsupported" key={question.name}>
              {`No renderer is registered for question type "${question.type}".`}
            </div>
          );
        }
        return <Renderer key={question.name} survey={survey} question={question} />;
      })}
    </section>
  );
}
