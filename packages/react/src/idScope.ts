import { createContext, useContext } from 'react';
import type { Context } from 'react';

/**
 * What makes one rendered survey's DOM ids its own — checklist P7.
 *
 * **`instanceKey` is unique inside a survey, not across two of them.** `questionId` had
 * always built from it, which solved the matrix's problem — a column's cells all carry the
 * column's name, so ids from the name alone repeat down the rows. It could not solve the
 * next one up: render *one definition twice* on a page, as the reference application's
 * playground does with a designer beside a live survey, and both emit
 * `id="kajay-question-name"`. The document then has duplicate ids and every `<label for>`
 * in the second resolves to the first — so a screen reader on the live survey is handed
 * the designer's input.
 *
 * The scope is a per-`<Survey>` prefix from React's own `useId`, which is exactly what it
 * is for and is stable across server and client rendering — so P1's server-rendered markup
 * still hydrates without an id mismatch.
 *
 * **Empty by default**, so a renderer used outside a `<Survey>` still produces the ids it
 * always did. Nothing has to know about this to keep working; what it buys is that two of
 * them no longer collide.
 */
export const IdScopeContext: Context<string> = createContext<string>('');

export function useIdScope(): string {
  return useContext(IdScopeContext);
}

/**
 * A scope safe to put in an id.
 *
 * React's `useId` returns something like `«r0»`, whose punctuation is legal in an `id`
 * attribute and awkward everywhere it is then used — a CSS selector, a `querySelector`, a
 * test. Reduced to what every one of those handles without escaping.
 */
export function toIdScope(generated: string): string {
  return `${generated.replaceAll(/[^a-zA-Z0-9]/gu, '')}-`;
}
