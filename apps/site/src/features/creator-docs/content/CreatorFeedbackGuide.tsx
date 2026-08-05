import type { ReactElement } from 'react';
import { CreatorCallout } from '../components/CreatorCallout';
import { CreatorCodeBlock } from '../components/CreatorCodeBlock';
import { CreatorDocSection } from '../components/CreatorDocSection';
import { CREATOR_NOTICE } from '../examples/creatorExamples';

export function CreatorFeedbackGuide(): ReactElement {
  return (
    <>
      <CreatorDocSection id="refused-edits" title="Refused edits">
        <p>
          An edit that cannot happen returns an <code>EditRefusal</code>. Its closed{' '}
          <code>kind</code> identifies the reason, and an optional <code>subject</code> names
          the value or type involved. <code>undefined</code> means the edit succeeded.
        </p>
        <p>
          Built-in Creator fields show refusals beside the control with an alert role. A
          custom control that calls a design-surface method should handle the returned value
          at the same interaction point.
        </p>
      </CreatorDocSection>
      <CreatorDocSection id="creator-notices" title="Creator notices">
        <p>
          Notices describe a successful automatic action that could otherwise be confusing:
          pasted names were renumbered, incompatible properties were dropped during a type
          conversion, or deleting a container also removed its children.
        </p>
        <p>
          They arrive through <code>surface.onNotice</code>. The default assembly renders the
          latest one in a persistent polite live region; composed Creators can use{' '}
          <code>CreatorNotices</code> or <code>useLatestNotice</code>.
        </p>
      </CreatorDocSection>
      <CreatorDocSection id="handle-feedback-in-custom-ui" title="Handle feedback in custom UI">
        <CreatorCodeBlock label="Refusals and notices in a composed Creator" code={CREATOR_NOTICE} />
        <CreatorCallout title="Use the Creator string catalogue">
          <p>
            Convert refusal and notice kinds with <code>refusalMessageKey</code> and{' '}
            <code>noticeMessageKey</code>, then resolve the key through the Creator dictionary.
            This keeps custom UI aligned with locale and white-label overrides.
          </p>
        </CreatorCallout>
      </CreatorDocSection>
      <CreatorDocSection id="when-to-use-each" title="When to use each">
        <ul className="text-muted-foreground list-disc space-y-2 pl-6">
          <li>A refusal answers the control that attempted an edit which did not happen.</li>
          <li>A notice announces something Kajay did automatically and successfully.</li>
          <li>Save failure is separate state owned by the save controller.</li>
          <li>Definition parse problems belong to the JSON editor and runtime diagnostics.</li>
        </ul>
      </CreatorDocSection>
    </>
  );
}
