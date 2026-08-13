import type { ReactElement } from 'react';
import type { DocPageDefinition } from '../docs-shell';
import { ReferenceSearchResults } from './ReferenceSearchResults';
import { useReferenceSearch } from './useReferenceSearch';

interface ReferenceSearchProps {
  readonly pages?: readonly DocPageDefinition[];
  readonly resultLimit?: number;
}

const EMPTY_PAGES: readonly DocPageDefinition[] = [];

export function ReferenceSearch({ pages = EMPTY_PAGES, resultLimit = 20 }: ReferenceSearchProps): ReactElement {
  const model = useReferenceSearch(pages, resultLimit);
  return (
    <div className="relative" onBlur={model.onBlur}>
      <label className="sr-only" htmlFor={`${model.id}-input`}>Search documentation</label>
      <input
        aria-activedescendant={model.isOpen && model.active !== undefined ? model.resultId(model.active) : undefined}
        aria-autocomplete="list"
        aria-controls={`${model.id}-results`}
        aria-expanded={model.isOpen}
        className="border-input bg-background placeholder:text-muted-foreground h-9 w-28 rounded-md border px-3 text-sm outline-none focus-visible:ring-2 sm:w-64"
        id={`${model.id}-input`}
        onChange={(event) => model.onChange(event.currentTarget.value)}
        onFocus={model.onFocus}
        onKeyDown={model.onKeyDown}
        placeholder="Search docs"
        ref={model.inputRef}
        role="combobox"
        type="search"
        value={model.query}
      />
      {model.isOpen ? (
        <div aria-label="Documentation search results" className="border-border bg-popover text-popover-foreground absolute top-11 right-0 z-50 w-[min(28rem,calc(100vw-2rem))] rounded-lg border shadow-lg" id={`${model.id}-results`} role="listbox">
          <ReferenceSearchResults
            activeId={model.active?.id}
            groups={model.groups}
            idPrefix={model.id}
            onActivate={model.onActivate}
            resultId={model.resultId}
          />
        </div>
      ) : null}
    </div>
  );
}
