import { parseSurvey } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { Survey } from '@kajay/react';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { KAJAY_SURVEY_COMPONENTS } from '@/kajay/surveyComponents';

/**
 * A real, server-rendered survey using this site's host primitive adapters.
 *
 * Checkbox and Textarea come from the site's shared UI kit. Radio uses the intentionally
 * small native adapter documented beside KAJAY_SURVEY_COMPONENTS. The survey model and all
 * of its behavior still come from Kajay's public API.
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
  const [survey] = useState(() => parseSurvey(DEMO).survey);

  return (
    <div data-testid="hero-survey">
      <Survey model={survey} components={KAJAY_SURVEY_COMPONENTS} />
    </div>
  );
}
