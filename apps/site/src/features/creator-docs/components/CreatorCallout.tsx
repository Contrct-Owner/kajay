import type { ReactElement, ReactNode } from 'react';

interface CreatorCalloutProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly kind?: 'note' | 'preview';
}

export function CreatorCallout({
  title,
  children,
  kind = 'note',
}: CreatorCalloutProps): ReactElement {
  const className =
    kind === 'preview'
      ? 'border-amber-500/40 bg-amber-500/10'
      : 'border-border bg-muted/40';

  return (
    <aside className={`${className} rounded-lg border p-5`} aria-label={title} role="note">
      <p className="mb-2 text-base font-semibold">{title}</p>
      <div className="text-muted-foreground space-y-2 text-sm">{children}</div>
    </aside>
  );
}
