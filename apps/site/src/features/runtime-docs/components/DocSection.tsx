import type { ReactElement, ReactNode } from 'react';

export function DocSection({
  id,
  title,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <section className="scroll-mt-24 border-b border-border py-9 last:border-b-0" aria-labelledby={id}>
      <h2 id={id} className="text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="mt-4 space-y-4 leading-7 text-foreground/90">{children}</div>
    </section>
  );
}
