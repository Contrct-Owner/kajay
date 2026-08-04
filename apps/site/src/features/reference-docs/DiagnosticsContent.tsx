import type { ReactElement } from 'react';
import type { DiagnosticReference } from '../docs-reference';
import { ReferenceTable } from './ReferenceTable';

interface DiagnosticsContentProps {
  readonly diagnostics: readonly DiagnosticReference[];
}

const CATEGORIES = ['definition', 'expression', 'dependency', 'survey'] as const;

export function DiagnosticsContent({ diagnostics }: DiagnosticsContentProps): ReactElement {
  return (
    <>
      <p>
        Diagnostic codes are stable lookup keys. Survey errors are extensible; the other
        categories below are the built-in runtime catalog.
      </p>
      {CATEGORIES.map((category) => {
        const rows = diagnostics.filter((item) => item.category === category);
        return (
          <section aria-labelledby={`diagnostic-${category}`} key={category}>
            <h2 className="capitalize" id={`diagnostic-${category}`}>{category} diagnostics</h2>
            <ReferenceTable
              caption={`${category} diagnostics`}
              columns={[
                { key: 'code', label: 'Code', render: (row) => <code id={anchor(row)} className="scroll-mt-24">{row.code}</code> },
                { key: 'phase', label: 'Phase / severity', render: (row) => [row.phase, row.severity].filter(Boolean).join(' · ') || 'Runtime' },
                { key: 'description', label: 'Meaning', render: (row) => row.description },
              ]}
              rows={rows}
              rowKey={(row) => row.code}
            />
          </section>
        );
      })}
    </>
  );
}

function anchor(item: DiagnosticReference): string {
  return item.url.slice(item.url.indexOf('#') + 1);
}
