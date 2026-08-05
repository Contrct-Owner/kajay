import type { ReactElement } from 'react';
import { CreatorCallout } from '../components/CreatorCallout';
import { CreatorCodeBlock } from '../components/CreatorCodeBlock';
import { CreatorDocSection } from '../components/CreatorDocSection';
import {
  CREATOR_COMPONENTS,
  CREATOR_STRINGS,
  PROPERTY_EDITOR,
} from '../examples/creatorExamples';

export function CreatorCustomizationGuide(): ReactElement {
  return (
    <>
      <CreatorDocSection id="use-design-system-components" title="Use design-system components">
        <p>
          Pass a partial Creator component map to replace buttons, inputs, selects,
          checkboxes, textareas, and menus. Missing entries keep the Kajay defaults.
        </p>
        <CreatorCodeBlock label="Creator and survey component maps" code={CREATOR_COMPONENTS} />
        <CreatorCallout title="Forward the behavioral props">
          <p>
            Replacement primitives must forward the supplied pointer, keyboard, ARIA, id,
            and event props to the interactive element. A component that drops them can
            silently break dragging, labels, or assistive-technology behavior.
          </p>
        </CreatorCallout>
        <p>
          Creator chrome and the previewed survey use separate component maps. Pass{' '}
          <code>components</code> for Creator controls and <code>surveyComponents</code> for
          the survey renderer.
        </p>
      </CreatorDocSection>
      <CreatorDocSection id="customize-words-and-theme" title="Customize words and theme">
        <p>
          Register only the Creator strings you want to replace; all other messages retain
          their built-in values. Creator locale is separate from the survey locale, and{' '}
          <code>creatorTheme</code> styles the tool rather than the survey being designed.
        </p>
        <CreatorCodeBlock label="White-label the Creator" code={CREATOR_STRINGS} />
      </CreatorDocSection>
      <CreatorDocSection id="replace-a-property-editor" title="Replace a property editor">
        <p>
          Use a resolver when a deployment knows more about a property than its registered
          primitive type. A resolver can match a property name, an editor kind, or both.
        </p>
        <CreatorCodeBlock label="A domain-specific property editor" code={PROPERTY_EDITOR} />
        <p>
          Put the supplied <code>id</code> on the control and wire{' '}
          <code>aria-describedby</code> to the supplied hint. Write through the provided
          design surface so restrictions, undo, serialization, and notices remain intact.
        </p>
      </CreatorDocSection>
    </>
  );
}
