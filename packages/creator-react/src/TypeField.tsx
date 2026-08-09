import type { DesignSurface } from '@kajay/creator-core';
import type { SurveyElement } from '@kajay/core';
import type { ReactElement } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';
import { useCreatorText } from './CreatorStringsContext.js';
import { PropertyLabel } from './PropertyLabel.js';

export interface TypeFieldProps {
  readonly surface: DesignSurface;
  readonly element: SurveyElement;
  readonly scope: string;
}

/**
 * What the selected element *is*, and what it could be — checklists K5 and P11.
 *
 * **Moved here from the adorner**, where it sat inline on every selected element. It had
 * not earned that: converting is rare, the rendered question already says what type it is —
 * a radiogroup looks like radios — and the picker was the only lossy edit on the canvas
 * sitting permanently under the cursor. Conversion drops every property the new type has no
 * place for, which P6 announces but which should still take a deliberate journey to reach.
 *
 * The grid is where facts about the selected element live, and this is the most fundamental
 * one, so it goes above `name`. **A special case rather than a mechanism**: `type` is not a
 * declared property — it is what decides which properties exist — so the grid asks the
 * surface for `convertibleTypes` exactly as the adorner used to, and nothing else in the
 * grid works this way.
 */
export function TypeField({ surface, element, scope }: TypeFieldProps): ReactElement | null {
  const { Select } = useCreatorComponents();
  const text = useCreatorText();
  const types = surface.convertibleTypes;

  // A page and the survey convert into nothing, and a lone option is a control that cannot
  // do anything — either way there is no choice to offer.
  if (types.length < 2) {
    return null;
  }

  return (
    <div className="kajay-properties__row" data-property="type">
      <PropertyLabel htmlFor={`kajay-prop-${scope}-type`} hasHint>
        {text('typeOf', String(element.getPropertyValue('name') ?? element.type))}
      </PropertyLabel>
      <Select
        id={`kajay-prop-${scope}-type`}
        className="kajay-properties__input"
        // Wired here for the first time. The hint has always been on screen, so nothing
        // needed to point at it; now that it is revealed on demand, the description has to
        // reach a screen reader the way every other row's does.
        aria-describedby={`kajay-prop-${scope}-type-hint`}
        data-testid={`property-${scope}-type`}
        value={element.type}
        options={types.map((type) => ({ value: type, label: type }))}
        onValueChange={(type) => {
          surface.convert(String(element.getPropertyValue('name') ?? ''), type);
        }}
      />
      <p className="kajay-properties__hint" id={`kajay-prop-${scope}-type-hint`}>
        {text('typeHint')}
      </p>
    </div>
  );
}
