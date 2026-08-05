import type { ReactElement } from 'react';
import { Callout } from '../components/Callout.js';
import { CodeBlock } from '../components/CodeBlock.js';
import { DocSection } from '../components/DocSection.js';
import {
  HOST_VALIDATION_SOURCE,
  VALIDATION_DEFINITION_SOURCE,
} from '../examples/runtimeExamples.js';

export function ValidationGuide(): ReactElement {
  return (
    <>
      <p className="text-lg leading-8 text-muted-foreground">
        Validation is a runtime gate, not browser-native form validation. The model checks every reachable
        question in scope, records actionable errors, and advances only when the gate passes.
      </p>
      <AuthoredValidation />
      <ValidationTiming />
      <HostValidation />
      <AsyncValidation />
      <ProgrammaticValidation />
    </>
  );
}

function AuthoredValidation(): ReactElement {
  return (
    <DocSection id="authored" title="Author required fields and validators">
        <p>
          <code>isRequired</code> handles empty answers. Validators run only after a non-empty answer exists,
          so one omission produces one useful message instead of a stack of failures.
        </p>
        <CodeBlock code={VALIDATION_DEFINITION_SOURCE} label="contact-survey.json" language="json" />
        <p>
          Built-in validator types are <code>numericvalidator</code>, <code>textvalidator</code>,
          <code>regexvalidator</code>, <code>emailvalidator</code>, <code>expressionvalidator</code>, and{' '}
          <code>answercountvalidator</code>. Their optional <code>text</code> property replaces the built-in
          localized failure message.
        </p>
    </DocSection>
  );
}

function ValidationTiming(): ReactElement {
  return (
    <DocSection id="timing" title="Choose when errors appear">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <caption className="sr-only">Validation timing modes</caption>
            <thead><tr className="border-b border-border"><th className="py-3 pr-4">Mode</th><th className="py-3">Behavior</th></tr></thead>
            <tbody>
              <tr className="border-b border-border"><td className="py-3 pr-4 font-mono">onNextPage</td><td className="py-3">Default. Check the current page when the respondent moves forward.</td></tr>
              <tr className="border-b border-border"><td className="py-3 pr-4 font-mono">onValueChanged</td><td className="py-3">Recheck only the visible question whose answer changed.</td></tr>
              <tr><td className="py-3 pr-4 font-mono">onComplete</td><td className="py-3">Allow intermediate moves, then check all reachable questions from the last page.</td></tr>
            </tbody>
          </table>
        </div>
        <Callout title="Visibility and enablement are different">
          A hidden question is outside validation scope because the respondent cannot act on it. A disabled
          question remains in scope: disabling freezes an answer; it does not withdraw the question.
        </Callout>
    </DocSection>
  );
}

function HostValidation(): ReactElement {
  return (
    <DocSection id="host" title="Add application and server rules">
        <p>
          Subscribe to <code>onValidateQuestion</code> for synchronous rules that need application knowledge.
          Install a <code>ServerValidator</code> for checks that need a round trip. Core performs no I/O itself.
        </p>
        <CodeBlock code={HOST_VALIDATION_SOURCE} label="configureValidation.ts" language="typescript" />
        <p>
          Validate the server&rsquo;s JSON response before returning it. Each accepted error names a question and
          supplies respondent-facing text. A rejected promise is a service failure, not a bad answer, and is
          exposed separately as <code>survey.validation.checkError</code>.
        </p>
    </DocSection>
  );
}

function AsyncValidation(): ReactElement {
  return (
    <DocSection id="async" title="Treat pending as its own state">
        <p>
          <code>survey.nextPageOrComplete()</code> returns <code>advanced</code>, <code>blocked</code>, or{' '}
          <code>pending</code>. Synchronous failures return <code>blocked</code> without starting remote work.
          A pending check advances automatically if it settles cleanly.
        </p>
        <p>
          Use <code>survey.validation.isValidating</code> or <code>onValidatingChanged</code> to show progress.
          Do not present <code>pending</code> as an answer error: no check has objected yet.
        </p>
    </DocSection>
  );
}

function ProgrammaticValidation(): ReactElement {
  return (
    <DocSection id="programmatic" title="Run and clear checks programmatically">
        <p>
          <code>validateCurrentPage()</code> checks the visible questions on the current page.
          <code>validateAll()</code> checks every reachable question, and <code>clear()</code> forgets recorded
          errors without checking again. Both validation methods are synchronous; out-of-process work runs only
          through the forward-navigation gate.
        </p>
    </DocSection>
  );
}
