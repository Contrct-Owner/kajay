import { Link, createFileRoute } from '@tanstack/react-router';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/')({ component: Landing });

/**
 * A placeholder, deliberately.
 *
 * Slice 0 exists to answer whether the primitive seam holds, and a landing page written
 * before that answer would be copy about a claim nobody had tested. The words come in
 * slice 4, once there is something true to say.
 */
function Landing(): ReactElement {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-6 px-6">
      <h1 className="text-4xl font-semibold tracking-tight">Kajay</h1>
      <p className="text-muted-foreground text-lg">
        A TypeScript-native survey engine and designer. This page is scaffolding — the
        playground is where slice 0 is being proved.
      </p>
      <div>
        <Button asChild>
          <Link to="/playground">Open the playground</Link>
        </Button>
      </div>
    </main>
  );
}

