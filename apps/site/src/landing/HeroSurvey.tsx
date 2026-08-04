import { parseSurvey } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { Survey } from '@kajay/react';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { KAJAY_SURVEY_COMPONENTS } from '@/kajay/surveyComponents';

/**
 * A real survey, on the landing page, drawn with this site's own components.
 *
 * **Not a screenshot and not a video.** The page's whole claim is that a Kajay survey looks
 * like the application around it; the cheapest way to be believed is for the thing making
 * the claim to be the thing itself. Every control below is the same `src/components/ui/`
 * source the buttons above it come from.
 *
 * **Server-rendered, deliberately** — checklists P1 and P7. Unlike the playground, which is
 * client-only because a design surface has to measure before it draws, nothing here needs a
 * DOM until somebody types. So this is the first survey the project serves as HTML, which
 * is what finally makes P1 an end-to-end claim rather than a unit-tested one: if the
 * renderer ever stops surviving the server again, this page goes blank in CI.
 */
const DEMO: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        {
          type: 'radiogroup',
          name: 'role',
          title: 'What are you building?',
          choices: [
            { value: 'product', text: 'A product with a survey in it' },
            { value: 'platform', text: 'A platform my customers build surveys on' },
            { value: 'looking', text: 'Still looking around' },
          ],
        },
        {
          type: 'checkbox',
          name: 'needs',
          title: 'What has to work on day one?',
          // Conditional on the first answer, so the demo shows logic doing something
          // rather than a page of inert fields.
          visibleIf: '{role} notempty',
          choices: [
            { value: 'branding', text: 'It has to match our branding' },
            { value: 'logic', text: 'Branching and conditional questions' },
            { value: 'i18n', text: 'More than one language' },
            { value: 'a11y', text: 'Accessibility we can defend' },
          ],
        },
        {
          type: 'comment',
          name: 'anything',
          title: 'Anything else?',
          visibleIf: '{needs} notempty',
          placeholder: 'Optional',
        },
      ],
    },
  ],
};

export function HeroSurvey(): ReactElement {
  // Built once. A survey rebuilt on every render would lose the answers as they were typed
  // — the same trap N1's `useCreatorWorkspace` exists to avoid, one layer simpler.
  const [survey] = useState(() => parseSurvey(DEMO).survey);

  return (
    // No frame of our own. The survey already draws a card, and wrapping it in a second
    // one would put a border between the reader and the claim — that this is what a Kajay
    // survey looks like inside an application, not what it looks like in a demo box.
    <div data-testid="hero-survey">
      <Survey model={survey} components={KAJAY_SURVEY_COMPONENTS} />
    </div>
  );
}
