import type { ReactElement, ReactNode } from 'react';
import { createContext, useContext } from 'react';
import type { PageElementRendererRegistry } from './PageElementRendererRegistry.js';

const QuestionRenderersContext = createContext<PageElementRendererRegistry | undefined>(
  undefined,
);

/**
 * Supplies the renderer registry to the tree.
 *
 * A question that contains questions needs it: a matrix cell is a real question of
 * whatever type its column declared, and drawing it means looking that type up in the
 * same registry the host configured — including the host's own replacements, or a cell
 * would silently fall back to the built-in renderer the host had deliberately swapped.
 *
 * Context rather than another prop on `QuestionRendererProps`, so the hundred renderers
 * that never draw a child question do not carry an argument they ignore.
 */
export function QuestionRenderersProvider({
  renderers,
  children,
}: {
  readonly renderers: PageElementRendererRegistry;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <QuestionRenderersContext.Provider value={renderers}>
      {children}
    </QuestionRenderersContext.Provider>
  );
}

export function useQuestionRenderers(): PageElementRendererRegistry {
  const renderers = useContext(QuestionRenderersContext);
  if (renderers === undefined) {
    throw new Error('Question renderers require a PageElementRendererRegistry provider.');
  }
  return renderers;
}
