import { useId } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { IdScopeContext, toIdScope } from './idScope.js';

export interface IdScopeProviderProps {
  readonly children: ReactNode;
}

/**
 * A fresh id scope for anything that draws a **second copy** of an element — P7 and P9.
 *
 * `<Survey>` has always minted one of these; this is the same mechanism with nothing else
 * attached, for the case `<Survey>` does not cover: markup that renders a question already
 * rendered somewhere else on the page. Without it both copies emit `id="kajay-question-x"`,
 * the document has duplicate ids, and every `<label for>` in the second resolves to the
 * first — which is exactly the defect P7 removed, reintroduced by the copy.
 *
 * The Creator's drag ghost is why it is public. A drag carries a picture of the question
 * being moved, and a picture of a question is that question's renderer run again; the
 * canvas is the only consumer that needs this today, and a host drawing their own preview
 * of an element they are also showing needs it for identical reasons — P9's rule is that a
 * seam exports what its own implementations use.
 *
 * Nesting is deliberate and safe: the innermost provider wins, so a copy inside a
 * `<Survey>` gets its own scope rather than the survey's.
 */
export function IdScopeProvider({ children }: IdScopeProviderProps): ReactElement {
  const scope = toIdScope(useId());
  return <IdScopeContext.Provider value={scope}>{children}</IdScopeContext.Provider>;
}
