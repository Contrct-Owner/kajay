import type { ReactElement } from 'react';
import { DotnetCodeBlock } from '../components/DotnetCodeBlock.js';
import { DotnetDocSection, DotnetNote } from '../components/DotnetDocSection.js';
import { DOTNET_HOST_OPTIONS } from '../examples/dotnetExamples.js';

export function DotnetHostingGuide(): ReactElement {
  return (
    <>
      <DotnetDocSection id="options" title="Compose host services with SurveyOptions">
        <p><code>SurveyOptions</code> supplies explicit clocks, endpoint origins, expression functions, validation, remote choices, and file operations without giving Kajay network or storage authority.</p>
        <DotnetCodeBlock code={DOTNET_HOST_OPTIONS} label="SurveyHost.cs" />
      </DotnetDocSection>
      <DotnetDocSection id="async" title="Use the asynchronous runtime path">
        <p>Call <code>CreateSurveyAsync</code>, <code>SetValueAsync</code>, <code>SettleAsync</code>, and <code>AdvanceAsync</code> when configured behavior may reach a host delegate.</p>
      </DotnetDocSection>
      <DotnetDocSection id="cancellation" title="Propagate cancellation and failures">
        <p>Every host operation receives a <code>CancellationToken</code> and an explicit UTC clock. Cancellation remains <code>OperationCanceledException</code>; contextual adapter failures use Kajay exception types.</p>
        <DotnetNote>Kajay defines when host work is requested. The host still owns authentication, retry, HTTP clients, credentials, logging, and circuit-breaking policy.</DotnetNote>
      </DotnetDocSection>
    </>
  );
}
