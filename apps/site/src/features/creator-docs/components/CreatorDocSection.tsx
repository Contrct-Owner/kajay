import type { ReactElement, ReactNode } from 'react';

interface CreatorDocSectionProps {
  readonly id: string;
  readonly title: string;
  readonly children: ReactNode;
}

export function CreatorDocSection({ id, title, children }: CreatorDocSectionProps): ReactElement {
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

