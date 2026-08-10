import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router';
import type { ReactElement, ReactNode } from 'react';
import styles from '../styles.css?url';
import { SITE_ORIGIN, SITE_TITLE, siteMeta } from '../siteMeta';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: SITE_TITLE },
      // Everything a reader who never runs the page gets: a search result, a link
      // preview, a card in a chat client. See `siteMeta`.
      ...siteMeta(),
    ],
    links: [
      { rel: 'stylesheet', href: styles },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      // Named rather than inferred, so a link arriving with tracking parameters or on the
      // `www` host is still one page as far as a search engine is concerned.
      { rel: 'canonical', href: SITE_ORIGIN },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { readonly children: ReactNode }): ReactElement {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
