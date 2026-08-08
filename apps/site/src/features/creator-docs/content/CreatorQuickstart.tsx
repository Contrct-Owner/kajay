import type { ReactElement } from 'react';
import { CreatorCallout } from '../components/CreatorCallout';
import { CreatorCodeBlock } from '../components/CreatorCodeBlock';
import { CreatorDocSection } from '../components/CreatorDocSection';
import { CREATOR_QUICKSTART } from '../examples/creatorExamples';

export function CreatorQuickstart(): ReactElement {
  return (
    <>
      <CreatorCallout title="Install the Creator" kind="preview">
        <p>
          <code>
            npm install @kajay/core @kajay/react @kajay/themes @kajay/creator-core
            @kajay/creator-react
          </code>
        </p>
      </CreatorCallout>
      <CreatorDocSection id="create-a-controlled-creator" title="Create a controlled Creator">
        <p>
          Keep the survey definition in your application state. <code>value</code> is the
          definition the Creator opens, and <code>onChange</code> receives a complete updated
          definition after an edit.
        </p>
        <CreatorCodeBlock label="A minimal React Creator" code={CREATOR_QUICKSTART} />
        <p>
          Feeding the updated value back into the Creator does not reopen the document or
          reset selection. A genuinely different value from your application is opened as a
          new edit and can be undone.
        </p>
      </CreatorDocSection>
      <CreatorDocSection id="what-the-creator-owns" title="What the Creator owns">
        <ul className="text-muted-foreground list-disc space-y-2 pl-6">
          <li>The design surface, selection, history, and drag placement session.</li>
          <li>Toolbox, property-grid, logic, JSON, translation, theme, and preview models.</li>
          <li>The default tabbed layout when you render <code>SurveyCreator</code>.</li>
        </ul>
        <p>
          Your application owns loading, persistence, authentication, backend requests, and
          the surrounding layout. The authored JSON definition remains the handoff between
          the Creator and the survey runtime.
        </p>
      </CreatorDocSection>
      <CreatorDocSection id="next-steps" title="Next steps">
        <p>
          <a href="/docs/creator/definitions-and-saving">Add a save function</a> when you are
          ready to persist definitions. <a href="/docs/creator/configuration">Configure a
          deployment</a> to restrict tabs, question types, or property rows. Use the{' '}
          <a href="/docs/creator/composition">composed pieces</a> only when the default assembly
          does not fit your application layout.
        </p>
      </CreatorDocSection>
    </>
  );
}
