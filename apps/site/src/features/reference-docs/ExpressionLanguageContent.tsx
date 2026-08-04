import type { ReactElement, ReactNode } from 'react';
import type {
  ExpressionFunctionReference,
  ExpressionOperatorReference,
  DocumentationGap,
} from '../docs-reference';
import { DocumentationGaps } from './DocumentationGaps';

interface ExpressionLanguageContentProps {
  readonly operators: readonly ExpressionOperatorReference[];
  readonly functions: readonly ExpressionFunctionReference[];
  readonly overview?: ReactNode;
  readonly evaluator?: ReactNode;
}

export function ExpressionLanguageContent({
  operators,
  functions,
  overview,
  evaluator,
}: ExpressionLanguageContentProps): ReactElement {
  return (
    <>
      {overview}
      {evaluator}
      <section aria-labelledby="expression-operators">
        <h2 id="expression-operators">Operators</h2>
        <p>Higher precedence binds more tightly. Alternative spellings print canonically as the operator name.</p>
        <DocumentationGaps gaps={gapsOf(operators)} />
        <div className="space-y-4">
          {operators.map((item) => <OperatorEntry item={item} key={`${item.kind}:${item.name}`} />)}
        </div>
      </section>
      <section aria-labelledby="expression-functions">
        <h2 id="expression-functions">Built-in functions</h2>
        <p>Function names are case-insensitive at evaluation time. Categories come from the built-in registry.</p>
        <DocumentationGaps gaps={gapsOf(functions)} />
        <div className="space-y-4">
          {functions.map((item) => <FunctionEntry item={item} key={item.name} />)}
        </div>
      </section>
    </>
  );
}

function OperatorEntry({ item }: { readonly item: ExpressionOperatorReference }): ReactElement {
  const id = item.url.slice(item.url.indexOf('#') + 1);
  return (
    <article className="border-border scroll-mt-24 rounded-lg border p-4" id={id}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="m-0"><code>{item.name}</code></h3>
        <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs">{item.kind}</span>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <div><dt className="text-muted-foreground">Spellings</dt><dd>{item.spellings.map((value) => <code className="mr-2" key={value}>{value}</code>)}</dd></div>
        <div><dt className="text-muted-foreground">Precedence</dt><dd>{item.precedence}</dd></div>
        <div><dt className="text-muted-foreground">Associativity</dt><dd>{item.associativity ?? 'Not applicable'}</dd></div>
      </dl>
    </article>
  );
}

function FunctionEntry({ item }: { readonly item: ExpressionFunctionReference }): ReactElement {
  const id = item.url.slice(item.url.indexOf('#') + 1);
  return (
    <article className="border-border scroll-mt-24 rounded-lg border p-4" id={id}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="m-0"><code>{item.name}()</code></h3>
        <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs">{item.category}</span>
      </div>
    </article>
  );
}

function gapsOf(items: readonly { readonly gaps: readonly DocumentationGap[] }[]): readonly DocumentationGap[] {
  return [...new Set(items.flatMap((item) => item.gaps))];
}
