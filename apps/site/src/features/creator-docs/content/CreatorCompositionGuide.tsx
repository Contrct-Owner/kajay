import type { ReactElement } from 'react';
import { CreatorCallout } from '../components/CreatorCallout';
import { CreatorCodeBlock } from '../components/CreatorCodeBlock';
import { CreatorDocSection } from '../components/CreatorDocSection';
import { COMPOSED_CREATOR, DEFAULT_CREATOR } from '../examples/creatorExamples';

export function CreatorCompositionGuide(): ReactElement {
  return (
    <>
      <CreatorDocSection id="start-with-survey-creator" title="Start with SurveyCreator">
        <p>
          <code>SurveyCreator</code> is the maintained default assembly. It owns one workspace
          and displays one view at a time: design, preview, logic, JSON, translations, or
          theme. Start here unless your product already has a layout the Creator must inhabit.
        </p>
        <CreatorCodeBlock label="The default assembly" code={DEFAULT_CREATOR} />
      </CreatorDocSection>
      <CreatorDocSection id="compose-the-pieces" title="Compose the pieces">
        <p>
          The same panels used by the default assembly are public. A composed Creator can put
          the toolbox in an application sidebar, the canvas in the main route, and the
          property grid in an inspector your product already owns.
        </p>
        <CreatorCodeBlock label="A custom Creator layout" code={COMPOSED_CREATOR} />
      </CreatorDocSection>
      <CreatorDocSection id="share-one-workspace" title="Share one workspace">
        <p>
          Create one workspace and pass each panel only the model it draws. In particular,
          the toolbox and canvas must share one placement object: a drag is one gesture that
          begins in the toolbox and ends on the design surface.
        </p>
        <ul className="text-muted-foreground list-disc space-y-2 pl-6">
          <li><code>workspace.surface</code> owns the document, selection, and history.</li>
          <li><code>workspace.toolbox</code> owns categories, search, and allowed items.</li>
          <li>Preview, JSON, logic, translations, and theme each have a narrow session.</li>
          <li><code>useCreatorWorkspace</code> disposes follower sessions on unmount.</li>
        </ul>
      </CreatorDocSection>
      <CreatorDocSection id="composition-responsibilities" title="Composition responsibilities">
        <CreatorCallout title="The pieces are intentionally low-level">
          <p>
            When you replace the default assembly, you own responsive layout, which views are
            mounted, save controls, and the placement of notices. Include
            <code>CreatorNotices</code> once so automatic changes are not silent.
          </p>
        </CreatorCallout>
        <p>
          Mounting preview beside design creates a complete second survey in the same
          document. That is supported, but labels and test queries must be scoped to the
          appropriate region. The default assembly avoids this ambiguity by showing one view
          at a time.
        </p>
      </CreatorDocSection>
    </>
  );
}

