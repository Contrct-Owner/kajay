import type { ReactElement } from 'react';
import { CreatorCallout } from '../components/CreatorCallout';
import { CreatorCodeBlock } from '../components/CreatorCodeBlock';
import { CreatorDocSection } from '../components/CreatorDocSection';
import { CREATOR_LOAD, CREATOR_SAVE } from '../examples/creatorExamples';

export function CreatorPersistenceGuide(): ReactElement {
  return (
    <>
      <CreatorDocSection id="load-a-definition" title="Load a definition">
        <p>
          Fetch and validate a survey in your application, then set it as the controlled
          value. The Creator does not fetch documents or choose a storage format for you.
        </p>
        <CreatorCodeBlock label="Open a survey from your backend" code={CREATOR_LOAD} />
        <CreatorCallout title="Definitions and responses are separate">
          <p>
            The Creator edits authored JSON. Respondent answers belong to a runtime survey
            session and should not be merged into the definition you save.
          </p>
        </CreatorCallout>
      </CreatorDocSection>
      <CreatorDocSection id="save-a-definition" title="Save a definition">
        <p>
          Pass a <code>save</code> function that returns <code>true</code> when persistence
          succeeds and <code>false</code> when it fails. It may be asynchronous. Without a
          saver, the default assembly does not show a save button.
        </p>
        <CreatorCodeBlock label="Save through a host-owned endpoint" code={CREATOR_SAVE} />
        <p>
          The default save control announces saving, saved, and failed states. A rejected
          promise counts as a failed save; logging and retry policy remain your application&rsquo;s
          responsibility.
        </p>
      </CreatorDocSection>
      <CreatorDocSection id="autosave-behavior" title="Autosave behavior">
        <p>
          Set <code>isAutoSave</code> to request a save after each Creator edit. Kajay does
          not add a timer or debounce. When changes arrive during an in-flight save, it keeps
          only the latest definition and runs one more save when the current request finishes.
        </p>
        <p>
          If your backend needs a delay or batch window, wrap the saver in your own scheduling
          policy. That keeps timing, cost, and cancellation decisions beside the backend they
          affect.
        </p>
      </CreatorDocSection>
      <IncomingChangesSection />
    </>
  );
}

function IncomingChangesSection(): ReactElement {
  return (
    <CreatorDocSection id="incoming-changes" title="Incoming changes and conflicts">
      <p>
        Changing <code>value</code> to a definition that differs from the Creator&rsquo;s most
        recent output opens that document through the same edit path and preserves undo.
        Kajay does not merge concurrent server revisions. Resolve revision conflicts before
        sending the winning definition back as <code>value</code>.
      </p>
    </CreatorDocSection>
  );
}
