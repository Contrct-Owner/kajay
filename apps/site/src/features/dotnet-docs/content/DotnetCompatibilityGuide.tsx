import type { ReactElement } from 'react';
import { DotnetDocSection, DotnetNote } from '../components/DotnetDocSection.js';

export function DotnetCompatibilityGuide(): ReactElement {
  return (
    <>
      <DotnetDocSection id="versions" title="Compare contracts, not package numbers">
        <p><code>KajayContracts</code> exposes the embedded schema, metadata, diagnostics, and supported conformance versions. npm and NuGet versions advance independently and do not establish interoperability.</p>
      </DotnetDocSection>
      <DotnetDocSection id="conformance" title="Know the current compatibility claim">
        <p><code>Kajay.Core</code> 1.x supports survey schema v1, conformance v1 and v2, and Response Snapshot Format v1. Published TypeScript 1.x claims conformance v1; its 2.x candidate passes v2.</p>
      </DotnetDocSection>
      <DotnetDocSection id="support" title="Rely on the package gates">
        <p>The release verifies nullable analysis, warnings-as-errors, package validation, Source Link, symbols, trimming, Native AOT analysis, public API compatibility, and a fresh installed-package consumer.</p>
        <DotnetNote>The shared definition reference is language-neutral. Use the <a href="/docs/reference/api/kajay-core">Kajay.Core API reference</a> for C#-specific types and signatures.</DotnetNote>
      </DotnetDocSection>
    </>
  );
}
