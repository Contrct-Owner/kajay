import type { ReactElement } from 'react';
import type { DocumentationSearchResult } from '../docs-reference';
import type { DocumentationSearchGroup } from './groupSearchResults';

interface ReferenceSearchResultsProps {
  readonly groups: readonly DocumentationSearchGroup[];
  readonly idPrefix: string;
  readonly activeId: string | undefined;
  readonly resultId: (result: DocumentationSearchResult) => string;
  readonly onActivate: (result: DocumentationSearchResult) => void;
}

export function ReferenceSearchResults({
  groups,
  idPrefix,
  activeId,
  resultId,
  onActivate,
}: ReferenceSearchResultsProps): ReactElement {
  if (groups.length === 0) {
    return <p className="text-muted-foreground m-0 px-3 py-4 text-sm" role="status">No documentation matches.</p>;
  }
  return (
    <div className="max-h-[min(28rem,70svh)] overflow-y-auto py-2">
      {groups.map((group) => (
        <section aria-labelledby={`${idPrefix}-group-${group.kind}`} key={group.kind} role="group">
          <div className="text-muted-foreground px-3 pt-2 pb-1 text-xs font-semibold tracking-wide uppercase" id={`${idPrefix}-group-${group.kind}`}>
            {group.label}
          </div>
          <ul className="m-0 list-none p-0">
            {group.results.map((result) => {
              const isActive = result.id === activeId;
              return (
                <li key={result.id}>
                  <a
                    aria-selected={isActive}
                    className={isActive ? 'bg-accent text-accent-foreground block px-3 py-2 no-underline' : 'hover:bg-muted block px-3 py-2 no-underline'}
                    href={result.url}
                    id={resultId(result)}
                    onMouseEnter={() => onActivate(result)}
                    role="option"
                  >
                    <span className="block text-sm font-medium">{result.title}</span>
                    <span className="text-muted-foreground mt-0.5 block truncate text-xs">{result.description}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
