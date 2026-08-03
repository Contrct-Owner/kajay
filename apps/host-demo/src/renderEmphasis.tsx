import { Fragment } from 'react';
import type { ReactNode } from 'react';

/**
 * The host's own text rendering — checklist I6.
 *
 * Deliberately the smallest thing that could be called markdown: `*emphasis*` becomes an
 * `<em>`. The point is the *seam*, not the syntax — a host wanting the real thing plugs
 * in a parser and their own sanitizer here, and the library never inserts markup it did
 * not build.
 *
 * Split rather than replaced into an HTML string, so nothing authored can become markup
 * by accident: every other segment is emphasised, and the rest is text.
 */
export function renderEmphasis(text: string): ReactNode {
  const segments = text.split('*');
  if (segments.length < 3) {
    return text;
  }
  return segments.map((segment, index) =>
    index % 2 === 1 ? (
      // eslint-disable-next-line react/no-array-index-key -- the split is the identity
      <em key={index}>{segment}</em>
    ) : (
      <Fragment key={index}>{segment}</Fragment>
    ),
  );
}
