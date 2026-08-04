import type { ReactElement } from 'react';
import type { DefinitionPropertyReference } from '../docs-reference';
import { DocumentationGaps } from './DocumentationGaps';
import { formatReferenceValue } from './formatReferenceValue';
import { ReferenceTable } from './ReferenceTable';

interface DefinitionPropertyContentProps {
  readonly item: DefinitionPropertyReference;
}

export function DefinitionPropertyContent({ item }: DefinitionPropertyContentProps): ReactElement {
  return (
    <>
      <DocumentationGaps gaps={item.gaps} />
      <section aria-labelledby="property-declarations">
        <h2 id="property-declarations">Declarations</h2>
        <ReferenceTable
          caption={`Declarations of ${item.name}`}
          columns={[
            { key: 'owner', label: 'Declared by', render: (row) => <code>{row.declaredBy}</code> },
            { key: 'type', label: 'Type', render: (row) => <code>{row.type}</code> },
            { key: 'default', label: 'Default', render: (row) => <code>{formatReferenceValue(row.defaultValue)}</code> },
            { key: 'description', label: 'Description', render: (row) => row.description ?? <span className="text-muted-foreground">Not documented</span> },
          ]}
          rows={item.occurrences}
          rowKey={(row) => row.declaredBy}
        />
      </section>
      <section aria-labelledby="property-behavior">
        <h2 id="property-behavior">Behavior flags</h2>
        <ReferenceTable
          caption={`Behavior flags for ${item.name}`}
          columns={[
            { key: 'owner', label: 'Declaration', render: (row) => <code>{row.declaredBy}</code> },
            { key: 'required', label: 'Required', render: (row) => yesNo(row.isRequired) },
            { key: 'expression', label: 'Expression', render: (row) => yesNo(row.isExpression) },
            { key: 'localizable', label: 'Localizable', render: (row) => yesNo(row.isLocalizable) },
            { key: 'visible', label: 'Applies when', render: (row) => condition(row.visibleIf) },
            { key: 'readonly', label: 'Read-only when', render: (row) => condition(row.readOnlyIf) },
          ]}
          rows={item.occurrences}
          rowKey={(row) => row.declaredBy}
        />
      </section>
      <section aria-labelledby="property-availability">
        <h2 id="property-availability">Available on</h2>
        <ul className="not-prose flex list-none flex-wrap gap-2 p-0">
          {item.availableOn.map((name) => (
            <li key={name}>
              <a className="bg-muted hover:bg-accent inline-flex rounded-md px-2 py-1 text-sm no-underline" href={`/docs/reference/definition-types/${name}`}>
                <code>{name}</code>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function yesNo(value: boolean): string {
  return value ? 'Yes' : 'No';
}

function condition(value: string | null): ReactElement | string {
  return value === null ? 'Always' : <code>{value}</code>;
}
