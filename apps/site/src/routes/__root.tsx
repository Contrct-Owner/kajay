import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router';
import type { ReactElement, ReactNode } from 'react';
import styles from '../styles.css?url';
import { SITE_ORIGIN, SITE_TITLE, siteMeta } from '../siteMeta';
import { APPEARANCE_SCRIPT } from '../appearance';

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
    // **`suppressHydrationWarning`, because the script below is *meant* to have changed
    // this element.** It runs before React does and writes a class and an attribute the
    // server did not send; without this, hydration reports the difference it was asked to
    // create.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          **First, and blocking, and before anything React owns.** The reader's appearance
          lives in their `localStorage` or their operating system, so the server cannot know
          it and no amount of rendering will help: the only place the answer can be applied
          before the browser paints is a script the parser runs on its way past. It used to
          be applied in an effect, which is after the first paint — so every reader who
          prefers dark got a white page and then the real one, on every load.
        */}
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
