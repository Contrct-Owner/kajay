import type { ReactElement } from 'react';
import type { ApiSymbolReference } from '../docs-reference';
import { DocumentationGaps } from './DocumentationGaps';

interface ApiSymbolContentProps {
  readonly item: ApiSymbolReference;
}

export function ApiSymbolContent({ item }: ApiSymbolContentProps): ReactElement {
  return (
    <>
      <DocumentationGaps gaps={item.gaps} />
      <section aria-labelledby="api-identity">
        <h2 id="api-identity">API identity</h2>
        <dl className="not-prose grid gap-3 sm:grid-cols-3">
          <Fact label="Package" value={item.packageName} />
          <Fact label="Kind" value={item.exportKind} />
          <Fact label="Audience" value={item.classification} />
        </dl>
      </section>
      <section aria-labelledby="api-signature">
        <h2 id="api-signature">Signature</h2>
        {item.signature === null ? (
          <p className="text-muted-foreground">No reliable published signature has been projected into the reference manifest yet.</p>
        ) : <pre><code>{item.signature}</code></pre>}
      </section>
    </>
  );
}

function Fact({ label, value }: { readonly label: string; readonly value: string }): ReactElement {
  return <div className="border-border rounded-lg border p-4"><dt className="text-muted-foreground text-xs uppercase">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>;
}
