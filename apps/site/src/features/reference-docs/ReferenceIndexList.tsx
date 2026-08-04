import type { ReactElement } from 'react';

export interface ReferenceIndexItem {
  readonly title: string;
  readonly description: string;
  readonly url: string;
  readonly badge?: string;
}

interface ReferenceIndexListProps {
  readonly items: readonly ReferenceIndexItem[];
  readonly emptyMessage: string;
}

export function ReferenceIndexList({ items, emptyMessage }: ReferenceIndexListProps): ReactElement {
  if (items.length === 0) {
    return <p className="text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <ul className="not-prose grid list-none gap-3 p-0 sm:grid-cols-2">
      {items.map((item) => (
        <li className="border-border rounded-lg border" key={item.url}>
          <a className="hover:bg-muted/40 block h-full rounded-lg p-4 no-underline" href={item.url}>
            <span className="flex items-start justify-between gap-3">
              <code className="text-foreground break-all font-semibold">{item.title}</code>
              {item.badge === undefined ? null : (
                <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs">
                  {item.badge}
                </span>
              )}
            </span>
            <span className="text-muted-foreground mt-2 block text-sm">{item.description}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
