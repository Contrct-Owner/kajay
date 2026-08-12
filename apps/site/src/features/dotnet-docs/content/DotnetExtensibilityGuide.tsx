import type { ReactElement } from 'react';
import { DotnetCodeBlock } from '../components/DotnetCodeBlock.js';
import { DotnetDocSection } from '../components/DotnetDocSection.js';
import { DOTNET_EXTENSION } from '../examples/dotnetExamples.js';

export function DotnetExtensibilityGuide(): ReactElement {
  return (
    <>
      <DotnetDocSection id="registry" title="Compose an immutable registry">
        <p>Start from <code>SurveyDefinitionRegistry.Default</code>. Each <code>WithProperty</code> or <code>WithClass</code> call returns a new registry, so configured registries are safe to reuse across definitions and parallel survey sessions.</p>
        <DotnetCodeBlock code={DOTNET_EXTENSION} label="SurveyExtensions.cs" />
      </DotnetDocSection>
      <DotnetDocSection id="questions" title="Register native question implementations">
        <p>A concrete custom question type may supply a <code>SurveyQuestionFactory</code>. Factories receive a <code>SurveyQuestionFactoryContext</code> and must preserve the same explicit-clock and cancellation conventions as built-in adapters.</p>
      </DotnetDocSection>
      <DotnetDocSection id="boundaries" title="Keep the extension portable">
        <p>Custom metadata belongs in the definition contract; platform presentation and environmental I/O stay in the host. A C# factory does not make its implementation portable to TypeScript.</p>
      </DotnetDocSection>
    </>
  );
}
