import type { ReactElement } from 'react';
import { DotnetCodeBlock } from '../components/DotnetCodeBlock.js';
import { DotnetDocSection, DotnetNote } from '../components/DotnetDocSection.js';
import { DOTNET_SNAPSHOT } from '../examples/dotnetExamples.js';

export function DotnetSnapshotsGuide(): ReactElement {
  return (
    <>
      <DotnetDocSection id="capture" title="Capture portable runtime state">
        <p>A Response Snapshot records tagged answers, the current page, locale, durable lifecycle, timer anchors, the definition digest, and its own format version.</p>
        <DotnetCodeBlock code={DOTNET_SNAPSHOT} label="SnapshotExample.cs" />
      </DotnetDocSection>
      <DotnetDocSection id="restore" title="Restore against the same definition">
        <p><code>RestoreSnapshot</code> rejects a mismatched definition before mutation and does not replay runtime events. The operation restores Kajay state, not host workflow state.</p>
      </DotnetDocSection>
      <DotnetDocSection id="host" title="Keep storage policy in the host">
        <DotnetNote>The host owns database keys, tenancy, encryption, retention, optimistic concurrency, and promotion. Store the snapshot JSON beside that metadata rather than adding it to the portable value.</DotnetNote>
      </DotnetDocSection>
    </>
  );
}
