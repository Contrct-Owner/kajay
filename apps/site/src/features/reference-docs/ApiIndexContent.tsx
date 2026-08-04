import type { ReactElement } from 'react';
import type { ApiSymbolReference } from '../docs-reference';
import { ReferenceIndexList } from './ReferenceIndexList';

interface ApiIndexContentProps {
  readonly items: readonly ApiSymbolReference[];
  readonly packageName?: string;
}

export function ApiIndexContent({ items, packageName }: ApiIndexContentProps): ReactElement {
  if (packageName === undefined) {
    const packages = [...new Set(items.map((item) => item.packageName))];
    return (
      <>
        <p>API reference covers every type and runtime value exported from a package root.</p>
        <ReferenceIndexList
          emptyMessage="No package exports are available."
          items={packages.map((name) => ({
            title: name,
            description: `${items.filter((item) => item.packageName === name).length} public symbols`,
            url: `/docs/reference/api/${packageSlug(name)}`,
          }))}
        />
      </>
    );
  }
  const packageItems = items.filter((item) => item.packageName === packageName);
  return (
    <ReferenceIndexList
      emptyMessage="This package has no public symbols."
      items={packageItems.map((item) => ({
        title: item.name,
        description: item.description ?? `${item.exportKind} export; consumer description not yet available.`,
        url: item.url,
        badge: item.classification,
      }))}
    />
  );
}

function packageSlug(value: string): string {
  return value.replace('@kajay/', '');
}
