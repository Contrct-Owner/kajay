import type { ReactElement } from 'react';
import { Callout } from '../components/Callout.js';
import { CodeBlock } from '../components/CodeBlock.js';
import { DocSection } from '../components/DocSection.js';
import { ExpressionEvaluator } from '../components/ExpressionEvaluator.js';
import { CONDITIONAL_DEFINITION_SOURCE } from '../examples/runtimeExamples.js';

export function ExpressionsGuide(): ReactElement {
  return (
    <>
      <p className="text-lg leading-8 text-muted-foreground">
        Expressions connect authored JSON to live answers. Kajay parses each expression, tracks the
        references it reads, and reruns only affected rules after an answer changes.
      </p>
      <Conditions />
      <References />
      <TryExpression />
      <FailureBehavior />
      <OtherUses />
    </>
  );
}

function Conditions(): ReactElement {
  return (
    <DocSection id="conditions" title="Drive element state with conditions">
        <p>Three properties cover the common conditional behaviors:</p>
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-4">
            <dt className="font-mono text-sm">visibleIf</dt>
            <dd className="mt-1 text-sm text-muted-foreground">Show the page, panel, question, or choice while truthy.</dd>
          </div>
          <div className="rounded-lg border border-border p-4">
            <dt className="font-mono text-sm">enableIf</dt>
            <dd className="mt-1 text-sm text-muted-foreground">Allow interaction while truthy.</dd>
          </div>
          <div className="rounded-lg border border-border p-4">
            <dt className="font-mono text-sm">requiredIf</dt>
            <dd className="mt-1 text-sm text-muted-foreground">Require a question while truthy.</dd>
          </div>
        </dl>
        <CodeBlock code={CONDITIONAL_DEFINITION_SOURCE} label="shipping-survey.json" language="json" />
        <Callout title="requiredIf overrides isRequired">
          When <code>requiredIf</code> is present, its current result decides requiredness. Removing the
          expression hands control back to the authored <code>isRequired</code> value.
        </Callout>
    </DocSection>
  );
}

function References(): ReactElement {
  return (
    <DocSection id="references" title="Reference answers by name">
        <p>
          Wrap an answer path in braces: <code>{'{rating}'}</code>, <code>{'{address.city}'}</code>, or
          <code>{'{rows[0].price}'}</code>. A missing path resolves to <code>undefined</code>; absent values
          compare equal to <code>null</code> and are considered empty.
        </p>
        <p>
          Operators and function names are case-insensitive. Canonical output normalizes alternatives such as
          <code>=</code> to <code>==</code>, <code>&amp;&amp;</code> to <code>and</code>, and <code>&lt;&gt;</code> to
          <code>!=</code>.
        </p>
    </DocSection>
  );
}

function TryExpression(): ReactElement {
  return (
    <DocSection id="evaluate" title="Try an expression">
        <p>
          Edit either input. This uses the same public parser, function registry, value resolver, evaluator,
          and canonical printer that an adapter can use.
        </p>
        <ExpressionEvaluator />
    </DocSection>
  );
}

function FailureBehavior(): ReactElement {
  return (
    <DocSection id="failure" title="Handle malformed logic safely">
        <p>
          Evaluation errors never throw out of the expression engine. Runtime logic exposes them through
          <code>survey.logicDiagnostics.expressionErrors</code>, including a stable code and source span.
        </p>
        <p>
          Conditional properties choose a safe fallback: a broken <code>visibleIf</code> or <code>enableIf</code>
          leaves content visible and enabled, while a broken <code>requiredIf</code> does not block submission.
        </p>
    </DocSection>
  );
}

function OtherUses(): ReactElement {
  return (
    <DocSection id="more" title="Beyond conditional properties">
        <p>
          The same language powers calculated values, expression questions, value rules, triggers, conditional
          completion messages, choice visibility, matrix totals, and expression validators. Use the expression
          <a href="/docs/reference/expression-language">expression language reference</a> when you need exact
          coercion, precedence, or function behavior.
        </p>
    </DocSection>
  );
}
