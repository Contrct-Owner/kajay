import type { Survey as SurveyModel } from '@kajay/core';
import { useSurveyComponents } from './SurveyComponents.js';
import type { ReactElement } from 'react';

export interface SurveyTocProps {
  readonly survey: SurveyModel;
}

/**
 * The pages, as somewhere to jump to.
 *
 * A real `<nav>` with a list of buttons, so it is one landmark a screen-reader user can
 * skip to and skip past — which is the whole reason a table of contents is worth having
 * on a long survey and the reason a row of unlabelled links is not.
 *
 * Buttons rather than links: nothing here changes the address, and a link that does not
 * go anywhere is a promise the page does not keep. The page they are on is marked with
 * `aria-current`, which is how "you are here" reaches someone who cannot see the
 * highlight.
 *
 * Jumping does **not** run the validation gate. A table of contents is for looking
 * around, and refusing to let someone glance at page four because page two is
 * incomplete makes it useless exactly when it is most wanted; the gate still stands
 * between them and completing.
 */
export function SurveyToc({ survey }: SurveyTocProps): ReactElement | null {
  const { Button } = useSurveyComponents();
  if (!survey.showTOC) {
    return null;
  }

  return (
    <nav className="kajay-toc" aria-label={survey.uiText('tableOfContents')}>
      <ol className="kajay-toc__list">
        {survey.visiblePages.map((page, index) => (
          <li key={page.name}>
            <Button
              type="button"
              className="kajay-toc__page"
              aria-current={index === survey.currentPageNo ? 'page' : undefined}
              onClick={() => {
                survey.goTo(page.name);
              }}
            >
              {page.title.length > 0 ? page.title : page.name}
            </Button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
