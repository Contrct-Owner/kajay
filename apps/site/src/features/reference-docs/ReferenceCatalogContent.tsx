import type { ReactElement } from 'react';
import { ReferenceIndexList, type ReferenceIndexItem } from './ReferenceIndexList';

interface ReferenceCatalogContentProps {
  readonly introduction: string;
  readonly items: readonly ReferenceIndexItem[];
}

export function ReferenceCatalogContent({
  introduction,
  items,
}: ReferenceCatalogContentProps): ReactElement {
  return (
    <>
      <p>{introduction}</p>
      <ReferenceIndexList emptyMessage="No reference entries are available." items={items} />
    </>
  );
}
