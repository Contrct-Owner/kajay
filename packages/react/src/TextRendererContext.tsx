import type { ReactElement, ReactNode } from 'react';
import { createContext, useContext } from 'react';

/**
 * Turns an author's text into what is drawn — checklist I6.
 *
 * The seam markdown goes through, and anything else a host wants: a title, a
 * description or an ending is *authored prose*, and whether it may contain emphasis,
 * a link, or a term from a glossary is a decision only the host can take.
 *
 * `where` says which piece of text is being asked about — `title`, `description` — so a
 * host can allow markup in a description and refuse it in a label without inspecting the
 * string.
 *
 * Returning a React node rather than an HTML string is deliberate: a host that wants
 * markup renders it themselves, with their own sanitizer, and the library never inserts
 * markup it did not build. That is the same boundary `sanitizeHtml` draws for the `html`
 * element, arrived at from the other side.
 */
export type TextRenderer = (text: string, where: string) => ReactNode;

const identity: TextRenderer = (text) => text;

const TextRendererContext = createContext<TextRenderer>(identity);

export function TextRendererProvider({
  renderText,
  children,
}: {
  readonly renderText: TextRenderer | undefined;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <TextRendererContext.Provider value={renderText ?? identity}>
      {children}
    </TextRendererContext.Provider>
  );
}

export function useTextRenderer(): TextRenderer {
  return useContext(TextRendererContext);
}
