import type { ReactElement, ReactNode } from 'react';
import { createContext, useContext } from 'react';

/** Turns author-supplied markup into markup that is safe to insert. */
export type HtmlSanitizer = (html: string) => string;

/**
 * Identity by default.
 *
 * The default has to be *something*, and the two candidates are "render it" and "strip
 * it". Stripping would make the `html` element useless out of the box for the ordinary
 * case — a definition written by the same people who wrote the host — and would push
 * anyone who wanted it working to reach for the escape hatch immediately, which is how
 * a safety default becomes a ritual nobody reads. Rendering it, with the boundary
 * stated on `HtmlElement` and a seam right here, is the honest arrangement.
 */
const identity: HtmlSanitizer = (html) => html;

const HtmlSanitizerContext = createContext<HtmlSanitizer>(identity);

/**
 * Supplies the sanitizer to the tree.
 *
 * Context rather than a prop threaded through page and panel: every element between
 * `<Survey>` and an `html` block would otherwise have to carry a prop it does not use,
 * and one of them forgetting is a silent hole rather than a type error.
 */
export function HtmlSanitizerProvider({
  sanitize,
  children,
}: {
  readonly sanitize: HtmlSanitizer | undefined;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <HtmlSanitizerContext.Provider value={sanitize ?? identity}>
      {children}
    </HtmlSanitizerContext.Provider>
  );
}

export function useHtmlSanitizer(): HtmlSanitizer {
  return useContext(HtmlSanitizerContext);
}
