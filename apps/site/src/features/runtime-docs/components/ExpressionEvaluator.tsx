import { useId, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { evaluateInteractiveExpression } from '../expression/evaluateInteractiveExpression.js';
import type { EvaluatorOutcome } from '../expression/evaluateInteractiveExpression.js';

export function ExpressionEvaluator(): ReactElement {
  const expressionId = useId();
  const valuesId = useId();
  const [expression, setExpression] = useState('{amount} + 1');
  const [values, setValues] = useState('{\n  "amount": "41"\n}');
  const outcome = useMemo(
    () => evaluateInteractiveExpression(expression, values),
    [expression, values],
  );

  return (
    <div className="my-6 rounded-xl border border-border bg-card p-4 sm:p-5">
      <EvaluatorFields
        expressionId={expressionId}
        valuesId={valuesId}
        expression={expression}
        values={values}
        setExpression={setExpression}
        setValues={setValues}
      />
      <EvaluatorResult outcome={outcome} />
      <p className="mt-3 text-xs text-muted-foreground">
        Date functions use the fixed reference clock 2026-08-02 12:34:56 UTC so results are repeatable.
      </p>
    </div>
  );
}

interface EvaluatorFieldsProps {
  readonly expressionId: string;
  readonly valuesId: string;
  readonly expression: string;
  readonly values: string;
  readonly setExpression: (value: string) => void;
  readonly setValues: (value: string) => void;
}

function EvaluatorFields(props: EvaluatorFieldsProps): ReactElement {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <label htmlFor={props.expressionId} className="grid gap-2 text-sm font-medium">
        Expression
        <input id={props.expressionId} className="rounded-md border border-input bg-background px-3 py-2 font-mono font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" value={props.expression} spellCheck={false} onChange={(event) => { props.setExpression(event.target.value); }} />
      </label>
      <label htmlFor={props.valuesId} className="grid gap-2 text-sm font-medium">
        Answer values (JSON)
        <textarea id={props.valuesId} className="min-h-28 resize-y rounded-md border border-input bg-background px-3 py-2 font-mono font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" value={props.values} spellCheck={false} onChange={(event) => { props.setValues(event.target.value); }} />
      </label>
    </div>
  );
}

function EvaluatorResult({ outcome }: { readonly outcome: EvaluatorOutcome }): ReactElement {
  if (outcome.kind === 'failure') {
    return (
      <div className="mt-4 rounded-lg bg-muted/60 p-4" aria-live="polite">
        <p className="text-sm font-medium text-destructive">Could not evaluate</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {outcome.errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      </div>
    );
  }
  return (
    <dl className="mt-4 grid gap-3 rounded-lg bg-muted/60 p-4 text-sm sm:grid-cols-2" aria-live="polite">
      <div><dt className="text-muted-foreground">Result</dt><dd className="mt-1 font-mono font-medium">{outcome.value}</dd></div>
      <div><dt className="text-muted-foreground">Canonical form</dt><dd className="mt-1 font-mono">{outcome.canonical}</dd></div>
    </dl>
  );
}
