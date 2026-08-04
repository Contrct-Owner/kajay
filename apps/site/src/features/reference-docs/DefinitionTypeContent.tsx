import type { ReactElement } from 'react';
import type { DefinitionTypeReference } from '../docs-reference';
import { DocumentationGaps } from './DocumentationGaps';
import { ReferenceTable } from './ReferenceTable';

interface DefinitionTypeContentProps {
  readonly item: DefinitionTypeReference;
}

export function DefinitionTypeContent({ item }: DefinitionTypeContentProps): ReactElement {
  return (
    <>
      <DocumentationGaps gaps={item.gaps} />
      <section aria-labelledby="definition-shape">
        <h2 id="definition-shape">Definition shape</h2>
        <dl className="not-prose grid gap-3 sm:grid-cols-3">
          <Fact label="Category" value={item.category} />
          <Fact label="Parent" value={item.parent ?? 'None'} />
          <Fact label="Availability" value={item.isAbstract ? 'Abstract base type' : 'Concrete type'} />
        </dl>
      </section>
      <section aria-labelledby="definition-properties">
        <h2 id="definition-properties">Properties</h2>
        <ReferenceTable
          caption={`Properties available on ${item.name}`}
          columns={[
            { key: 'name', label: 'Property', render: (row) => <a href={`/docs/reference/properties/${propertySlug(row.name)}`}><code>{row.name}</code></a> },
            { key: 'owner', label: 'Declared by', render: (row) => <code>{row.declaredBy}</code> },
          ]}
          rows={item.effectiveProperties}
          rowKey={(row) => row.name}
        />
      </section>
      <section aria-labelledby="child-collections">
        <h2 id="child-collections">Child collections</h2>
        {item.childCollections.length === 0 ? <p>This type has no child collections.</p> : (
          <ReferenceTable
            caption={`Child collections on ${item.name}`}
            columns={[
              { key: 'property', label: 'Property', render: (row) => <code>{row.property}</code> },
              { key: 'type', label: 'Element base type', render: (row) => <code>{row.elementBaseType}</code> },
              { key: 'shorthand', label: 'Scalar shorthand', render: (row) => row.shorthandProperty === null ? 'None' : <code>{row.shorthandProperty}</code> },
            ]}
            rows={item.childCollections}
            rowKey={(row) => row.property}
          />
        )}
      </section>
    </>
  );
}

function Fact({ label, value }: { readonly label: string; readonly value: string }): ReactElement {
  return <div className="border-border rounded-lg border p-4"><dt className="text-muted-foreground text-xs uppercase">{label}</dt><dd className="mt-1 font-medium capitalize">{value}</dd></div>;
}

function propertySlug(value: string): string {
  return value.replaceAll(/([a-z0-9])([A-Z])/gu, '$1-$2').toLocaleLowerCase('en-US');
}
