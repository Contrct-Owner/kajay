import type { ReactElement } from 'react';

interface DotnetCodeBlockProps {
  readonly code: string;
  readonly label: string;
}

export function DotnetCodeBlock({ code, label }: DotnetCodeBlockProps): ReactElement {
  return (
    <figure className="my-5 min-w-0 overflow-hidden rounded-xl border border-border bg-muted/35">
      <figcaption className="flex items-center justify-between border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono uppercase">csharp</span>
      </figcaption>
      <pre className="overflow-x-auto p-4 text-sm leading-6"><code>{code}</code></pre>
    </figure>
  );
}
