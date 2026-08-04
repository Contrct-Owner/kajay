import type { ReactElement } from 'react';
import type { DocTableOfContentsItem } from './DocPageDefinition';

interface DocsTableOfContentsProps {
  readonly items: readonly DocTableOfContentsItem[];
}

export function DocsTableOfContents({ items }: DocsTableOfContentsProps): ReactElement {
  return (
    <nav aria-label="On this page">
      <h2 className="mb-3 text-sm font-semibold">On this page</h2>
      <ul className="border-border space-y-2 border-l text-sm">
        {items.map((item) => (
          <li key={item.id} className={item.depth === 3 ? 'pl-6' : 'pl-4'}>
            <a className="text-muted-foreground hover:text-foreground" href={`#${item.id}`}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

