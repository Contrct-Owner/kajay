import type { ReactElement } from 'react';
import { CreatorCallout } from '../components/CreatorCallout';
import { CreatorCodeBlock } from '../components/CreatorCodeBlock';
import { CreatorDocSection } from '../components/CreatorDocSection';
import { CREATOR_CONFIGURATION, CREATOR_WORKSPACE } from '../examples/creatorExamples';

export function CreatorConfigurationGuide(): ReactElement {
  return (
    <>
      <CreatorDocSection id="configure-the-default-assembly" title="Configure the default assembly">
        <p>
          Use <code>tabs</code> to choose the visible views and their order. Use{' '}
          <code>configuration</code> for deployment restrictions that must apply beyond the
          visible controls.
        </p>
        <CreatorCodeBlock label="A restricted deployment" code={CREATOR_CONFIGURATION} />
        <p>
          Allowed and blocked types affect the toolbox, conversion, paste, and other edit
          paths. They are enforcement rules, not merely a hidden button. An empty{' '}
          <code>allowedTypes</code> list means no types may be added.
        </p>
      </CreatorDocSection>
      <CreatorDocSection id="configure-the-property-grid" title="Configure the property grid">
        <p>
          Grid configuration can hide properties, change their labels or categories, and
          move selected rows earlier in their existing sections. Hiding a row affects the
          editor only; it does not remove an existing value from the definition.
        </p>
        <ul className="text-muted-foreground list-disc space-y-2 pl-6">
          <li><code>hidden</code> removes named rows and collections from the grid.</li>
          <li><code>titles</code> replaces derived labels by property name.</li>
          <li><code>categories</code> moves properties into named sections.</li>
          <li><code>categoryOrder</code> and <code>order</code> control presentation order.</li>
        </ul>
      </CreatorDocSection>
      <CreatorDocSection id="workspace-lifetime" title="Workspace lifetime">
        <p>
          Registry, configuration, and session seams are initialization options. A changed
          survey document goes through the controlled-value contract; a changed deployment
          creates a different workspace.
        </p>
        <CreatorCodeBlock label="Keep one deployment per workspace" code={CREATOR_WORKSPACE} />
        <CreatorCallout title="Read-only is still a viewer">
          <p>
            <code>isReadOnly</code> prevents all edits while leaving the canvas, JSON, logic,
            and property values available to inspect. Hide tabs separately when reviewers
            should not see a view at all.
          </p>
        </CreatorCallout>
      </CreatorDocSection>
    </>
  );
}
