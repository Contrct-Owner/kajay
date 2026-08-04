import { useEffect, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

/**
 * Renders its children only once the browser has them.
 *
 * The Creator is a live document with an undo stack, a selection and a drag gesture; there
 * is nothing for a server to render and nothing a server render would be right about. The
 * *survey renderer* is a different question, and slice 0 answers it separately — this
 * wrapper is deliberately not applied to that.
 */
export function ClientOnly({
  children,
  fallback,
}: {
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
}): ReactElement {
  const [isMounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return <>{isMounted ? children : fallback}</>;
}
