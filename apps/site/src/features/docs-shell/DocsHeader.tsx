import { Link } from '@tanstack/react-router';
import type { ReactElement, ReactNode } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';

interface DocsHeaderProps {
  readonly toolbar?: ReactNode;
}

export function DocsHeader({ toolbar }: DocsHeaderProps): ReactElement {
  return (
    <header className="border-border bg-background/95 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[96rem] items-center gap-4 px-4 sm:px-6">
        <Link className="font-semibold tracking-tight" to="/">
          Kajay
        </Link>
        <span className="text-muted-foreground" aria-hidden="true">
          /
        </span>
        <Link className="font-medium" to="/docs">
          Docs
        </Link>
        <span className="bg-secondary text-secondary-foreground hidden rounded-full px-2 py-0.5 text-xs font-medium sm:inline-flex">
          Preview
        </span>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {toolbar}
          <Link
            className="text-muted-foreground hover:text-foreground hidden text-sm sm:inline"
            to="/playground"
          >
            Playground
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
