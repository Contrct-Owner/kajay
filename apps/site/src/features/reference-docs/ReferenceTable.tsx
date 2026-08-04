import type { ReactElement, ReactNode } from 'react';

export interface ReferenceTableColumn<Row> {
  readonly key: string;
  readonly label: string;
  readonly render: (row: Row) => ReactNode;
}

interface ReferenceTableProps<Row> {
  readonly caption: string;
  readonly columns: readonly ReferenceTableColumn<Row>[];
  readonly rows: readonly Row[];
  readonly rowKey: (row: Row) => string;
}

export function ReferenceTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
}: ReferenceTableProps<Row>): ReactElement {
  return (
    <div className="not-prose border-border overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/50">
          <tr>
            {columns.map((column) => <th className="px-4 py-3 font-medium" key={column.key}>{column.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => <td className="px-4 py-3 align-top" key={column.key}>{column.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
