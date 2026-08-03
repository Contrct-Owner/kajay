import type { PageElement, Survey as SurveyModel } from '@kajay/core';
import type { ReactElement } from 'react';
import type { PageElementRendererRegistry } from './PageElementRendererRegistry.js';

export interface SurveyElementsProps {
  readonly survey: SurveyModel;
  readonly elements: readonly PageElement[];
  readonly renderers: PageElementRendererRegistry;
}

/**
 * Draws a list of page elements through the one registered dispatch path.
 */
export function SurveyElements({
  survey,
  elements,
  renderers,
}: SurveyElementsProps): ReactElement {
  return (
    <>
      {elements.map((element) => (
        <ElementSlot key={element.name}>{renderers.render(survey, element)}</ElementSlot>
      ))}
    </>
  );
}

function ElementSlot({ children }: { readonly children: ReactElement }): ReactElement {
  return children;
}
