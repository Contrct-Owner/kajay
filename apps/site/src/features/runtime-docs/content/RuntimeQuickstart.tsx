import type { ReactElement } from 'react';
import { Callout } from '../components/Callout.js';
import { CodeBlock } from '../components/CodeBlock.js';
import { DocSection } from '../components/DocSection.js';
import { QuickstartDemo } from '../components/QuickstartDemo.js';
import {
  QUICKSTART_COMPONENT_SOURCE,
  QUICKSTART_DEFINITION_SOURCE,
} from '../examples/runtimeExamples.js';

export function RuntimeQuickstart(): ReactElement {
  return (
    <>
      <Callout title="Install Kajay 1.x">
        <code>npm install @kajay/core @kajay/react @kajay/themes</code>
      </Callout>
      <DocSection id="define" title="1. Define the survey">
        <p>
          A survey definition is plain JSON-compatible data. Names identify questions and become answer
          keys unless a question declares a different <code>valueName</code>.
        </p>
        <CodeBlock code={QUICKSTART_DEFINITION_SOURCE} label="survey.ts" language="typescript" />
      </DocSection>
      <DocSection id="render" title="2. Parse and render it">
        <p>
          <code>parseSurvey</code> creates the stateful runtime model. Build it once for a mounted survey;
          rebuilding the model during render would discard the respondent&rsquo;s answers.
        </p>
        <CodeBlock code={QUICKSTART_COMPONENT_SOURCE} label="FeedbackSurvey.tsx" language="tsx" />
        <Callout title="Check definition diagnostics">
          <code>parseSurvey</code> throws only when it cannot create a useful model, such as for a non-object
          definition or unsupported schema version. Unknown properties and wrong property types are returned
          in the <code>diagnostics</code> array so an authoring surface can report all of them together.
        </Callout>
      </DocSection>
      <DocSection id="try" title="3. Try the result">
        <p>
          Choose <strong>Poor</strong> to exercise the expression on <code>visibleIf</code>. Completion emits a
          snapshot of the submitted answers through <code>model.onComplete</code>.
        </p>
        <QuickstartDemo />
      </DocSection>
      <DocSection id="next" title="Where to go next">
        <p>
          Learn how conditions react to answers in <a href="/docs/surveys/expressions">Expressions and
          conditional logic</a>, then add required fields and authored checks in{' '}
          <a href="/docs/surveys/validation">Validation</a>.
        </p>
      </DocSection>
    </>
  );
}
