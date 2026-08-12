import type { ReactElement } from 'react';
import { DotnetCodeBlock } from '../components/DotnetCodeBlock.js';
import { DotnetDocSection, DotnetNote } from '../components/DotnetDocSection.js';
import { DOTNET_QUICKSTART } from '../examples/dotnetExamples.js';

export function DotnetQuickstart(): ReactElement {
  return (
    <>
      <DotnetNote><strong>Install:</strong> <code>dotnet add package Kajay.Core --version 1.0.0</code></DotnetNote>
      <DotnetDocSection id="parse" title="1. Parse a definition">
        <p><code>SurveyDefinition.Parse</code> validates schema compatibility, preserves recoverable author diagnostics, and returns an immutable definition that can create independent survey sessions.</p>
        <DotnetCodeBlock code={DOTNET_QUICKSTART} label="Program.cs" />
      </DotnetDocSection>
      <DotnetDocSection id="run" title="2. Run the survey">
        <p>Set answers with <code>KajayValue</code>, inspect typed questions when a host needs presentation metadata, and use the asynchronous navigation methods whenever configured validation or host I/O can run.</p>
      </DotnetDocSection>
      <DotnetDocSection id="ownership" title="3. Keep ownership explicit">
        <p>A definition is immutable and reusable. Each <code>CreateSurvey</code> call creates one mutable session with one logical owner; do not mutate the same survey concurrently.</p>
      </DotnetDocSection>
      <DotnetDocSection id="next" title="Where to go next">
        <p>Persist portable state with <a href="/docs/dotnet/snapshots">Response Snapshots</a>, then connect host services through <a href="/docs/dotnet/hosting">hosting adapters</a>.</p>
      </DotnetDocSection>
    </>
  );
}
