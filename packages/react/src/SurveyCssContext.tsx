import type { ReactElement, ReactNode } from 'react';
import { createContext, useContext } from 'react';

/**
 * Extra class names a host adds to the parts of a survey — checklist I4.
 *
 * Keyed by *part*, not by element type: a host restyling a survey thinks in terms of
 * "the questions", "the next button", not in terms of every question type there is. The
 * supported keys are the ones documented in `docs/design-tokens.md`; an unknown key is
 * simply never asked for, which makes a typo inert rather than an error at the wrong
 * moment.
 *
 * These are **added** to the built-in names, never substituted for them. Replacing them
 * would take the shipped stylesheet with it and leave a host that wanted one extra class
 * reimplementing everything.
 *
 * Supplied per `<Survey>` rather than in the definition on purpose: a class name is a
 * fact about one host's stylesheet, and a definition that carried one would stop being
 * portable to the next host.
 */
export type SurveyCss = Readonly<Record<string, string>>;

const SurveyCssContext = createContext<SurveyCss>({});

export function SurveyCssProvider({
  css,
  children,
}: {
  readonly css: SurveyCss | undefined;
  readonly children: ReactNode;
}): ReactElement {
  return <SurveyCssContext.Provider value={css ?? {}}>{children}</SurveyCssContext.Provider>;
}

/** The class attribute for one part: what the library ships, plus what the host added. */
export function useCssClass(part: string, base: string): string {
  const css = useContext(SurveyCssContext);
  const extra = css[part];
  return extra === undefined || extra.length === 0 ? base : `${base} ${extra}`;
}
