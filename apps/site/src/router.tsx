import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

/**
 * The name Start looks for. Exporting `createRouter` instead fails at request time with
 * `entries.routerEntry.getRouter is not a function` — a runtime error for what is really a
 * naming contract, which is worth remembering when we write about DX.
 */
export function getRouter(): ReturnType<typeof createRouter<typeof routeTree>> {
  return createRouter({ routeTree, scrollRestoration: true });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
