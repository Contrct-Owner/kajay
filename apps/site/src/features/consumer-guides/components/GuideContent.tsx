import type { ReactElement, ReactNode } from 'react';

export interface GuideSectionDefinition {
  readonly id: string;
  readonly title: string;
  readonly body: ReactNode;
  readonly code?: string;
  readonly codeLabel?: string;
}

interface GuideContentProps {
  readonly sections: readonly GuideSectionDefinition[];
}

export function GuideContent({ sections }: GuideContentProps): ReactElement {
  return (
    <>
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={section.id}>
          <h2 id={section.id}>{section.title}</h2>
          {section.body}
          {section.code === undefined ? null : (
            <figure className="min-w-0 space-y-2">
              <figcaption className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {section.codeLabel ?? 'TypeScript'}
              </figcaption>
              <pre className="overflow-x-auto">
                <code>{section.code}</code>
              </pre>
            </figure>
          )}
        </section>
      ))}
    </>
  );
}

export function ResponsibilityList({ children }: { readonly children: ReactNode }): ReactElement {
  return <ul className="text-muted-foreground list-disc space-y-2 pl-6">{children}</ul>;
}

export function GuideNote({ children }: { readonly children: ReactNode }): ReactElement {
  return (
    <aside className="border-border bg-muted/40 rounded-lg border p-4 text-sm" role="note">{children}</aside>
  );
}
