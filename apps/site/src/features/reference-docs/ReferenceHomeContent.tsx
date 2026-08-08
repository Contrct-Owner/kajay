import type { ReactElement } from 'react';
import type { DocsReferenceManifest } from '../docs-reference';

interface ReferenceHomeContentProps {
  readonly manifest: DocsReferenceManifest;
}

export function ReferenceHomeContent({ manifest }: ReferenceHomeContentProps): ReactElement {
  const cards = [
    ['Definition types', manifest.definitionTypes.length, '/docs/reference/definition-types'],
    ['Properties', manifest.definitionProperties.length, '/docs/reference/properties'],
    ['Diagnostics', manifest.diagnostics.length, '/docs/reference/diagnostics'],
    ['API symbols', manifest.apiSymbols.length, '/docs/reference/api'],
  ] as const;
  return (
    <>
      <section aria-labelledby="reference-sources">
        <h2 id="reference-sources">Generated from Kajay itself</h2>
        <p>
          These facts come from Kajay&apos;s committed Schema and runtime contracts, expression
          registries, package exports, and public-interface ledger. Missing documentation is
          called out explicitly on the affected entry.
        </p>
      </section>
      <section aria-labelledby="reference-catalogs">
        <h2 id="reference-catalogs">Browse reference</h2>
        <ul className="not-prose grid list-none gap-3 p-0 sm:grid-cols-2">
          {cards.map(([label, count, url]) => (
            <li className="border-border rounded-lg border" key={url}>
              <a className="hover:bg-muted/40 block rounded-lg p-5 no-underline" href={url}>
                <span className="text-foreground block font-semibold">{label}</span>
                <span className="text-muted-foreground mt-1 block text-sm">{count} entries</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="reference-version">
        <h2 id="reference-version">Compatibility</h2>
        <p>
          Definition Schema {manifest.sources.definitionSchemaVersion}; expression conformance{' '}
          {manifest.sources.expressionConformanceVersion}. This reference describes the published
          TypeScript 1.0 package surface.
        </p>
      </section>
    </>
  );
}
