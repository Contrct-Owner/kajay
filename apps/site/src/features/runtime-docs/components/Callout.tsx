import type { ReactElement, ReactNode } from 'react';

export function Callout({ title, children }: { readonly title: string; readonly children: ReactNode }): ReactElement {
  return (
    <aside className="my-6 rounded-xl border border-border bg-card p-4" role="note">
      <p className="font-medium">{title}</p>
      <div className="mt-1 text-sm leading-6 text-muted-foreground">{children}</div>
    </aside>
  );
}
