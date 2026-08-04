import type { ReactElement } from 'react';

interface CreatorCodeBlockProps {
  readonly code: string;
  readonly label: string;
}

export function CreatorCodeBlock({ code, label }: CreatorCodeBlockProps): ReactElement {
  return (
    <figure className="space-y-2">
      <figcaption className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </figcaption>
      <pre aria-label={label}>
        <code>{code}</code>
      </pre>
    </figure>
  );
}

