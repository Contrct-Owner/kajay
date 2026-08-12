import type { ReactElement, ReactNode } from 'react';

interface DotnetDocSectionProps {
  readonly children: ReactNode;
  readonly id: string;
  readonly title: string;
}

export function DotnetDocSection({ children, id, title }: DotnetDocSectionProps): ReactElement {
  return <section aria-labelledby={id}><h2 id={id}>{title}</h2>{children}</section>;
}

export function DotnetNote({ children }: { readonly children: ReactNode }): ReactElement {
  return <aside className="my-6 rounded-xl border border-border bg-card p-4 text-sm" role="note">{children}</aside>;
}
