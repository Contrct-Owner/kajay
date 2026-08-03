import type { Page, Survey as SurveyModel } from '@kajay/core';
import type { CSSProperties, ReactElement } from 'react';
import type { PageElementRendererRegistry } from './PageElementRendererRegistry.js';
import { SurveyElements } from './SurveyElements.js';
import { useCssClass } from './SurveyCssContext.js';

export interface SurveyPageProps {
  readonly survey: SurveyModel;
  readonly page: Page;
  readonly renderers: PageElementRendererRegistry;
}

/**
 * Draws one page's visible elements.
 *
 * Internal to the package: the public surface is `<Survey model={...} />`, and a host
 * customises rendering by registering renderers rather than by composing internals.
 */
export function SurveyPage({ survey, page, renderers }: SurveyPageProps): ReactElement {
  const className = useCssClass('page', 'kajay-page');
  // The column count reaches CSS as a variable rather than as a class per count: an
  // author may ask for any number, and a stylesheet cannot enumerate them.
  const columns = { '--kajay-col-count': String(page.colCount) } as CSSProperties;

  return (
    // Labelled only when it has a title. A page name is an identifier, not prose, and
    // announcing it was actively harmful under `questionPerPage`: the synthetic page is
    // named for the question it wraps, so screen readers heard the name twice — once as
    // the region, once as the field.
    <section
      className={className}
      style={columns}
      aria-label={page.title.length > 0 ? page.title : undefined}
    >
      {page.title.length > 0 ? <h2 className="kajay-page__title">{page.title}</h2> : null}
      <SurveyElements survey={survey} elements={page.visibleElements} renderers={renderers} />
    </section>
  );
}
