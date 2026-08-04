import { CreatorStringDictionary } from '@kajay/creator-core';
import type { CreatorStringKey } from '@kajay/creator-core';
import { createContext, useContext, useMemo } from 'react';
import type { ReactElement, ReactNode } from 'react';

/** What a piece calls to say something. `text('save')`, `text('titleOf', name)`. */
export type CreatorText = (
  key: CreatorStringKey,
  ...parameters: readonly (string | number)[]
) => string;

interface CreatorStringsValue {
  readonly dictionary: CreatorStringDictionary;
  readonly locale: string;
}

/**
 * The shipped English, for a piece rendered with no provider anywhere.
 *
 * Module-level and shared, which is safe because it is never written to: a host who
 * registers anything is a host who has supplied a provider, and this one is only ever
 * read. The alternative — building a dictionary per render — would allocate eighty strings
 * to answer one question.
 */
const DEFAULT: CreatorStringsValue = {
  dictionary: new CreatorStringDictionary(),
  locale: 'en',
};

const CreatorStringsContext = createContext<CreatorStringsValue>(DEFAULT);

export interface CreatorStringsProviderProps {
  readonly dictionary: CreatorStringDictionary;
  /** Which language the Creator's own chrome is in. Defaults to English. */
  readonly locale?: string | undefined;
  readonly children: ReactNode;
}

/**
 * Supplies the Creator's words to everything below — checklist N3.
 *
 * A context rather than a prop threaded through every piece, for the reason
 * [ADR-0021](../../../docs/adr/0021-creator-composition.md) allows one at all: the language
 * a *tool* speaks is a fact about the application, not about any one panel, and it is not
 * model state. A piece rendered with no provider gets English and works — which is what
 * keeps the pieces usable alone.
 *
 * **Separate from the survey's own locale.** A designer working in German on a survey
 * written in French wants German chrome and French content, and a Creator that tied the two
 * together would make that impossible to say.
 */
export function CreatorStringsProvider({
  dictionary,
  locale = 'en',
  children,
}: CreatorStringsProviderProps): ReactElement {
  const value = useMemo(() => ({ dictionary, locale }), [dictionary, locale]);

  return (
    <CreatorStringsContext.Provider value={value}>{children}</CreatorStringsContext.Provider>
  );
}

/** The Creator's words, in the language in force here. */
export function useCreatorText(): CreatorText {
  const { dictionary, locale } = useContext(CreatorStringsContext);
  return useMemo(
    () =>
      (key, ...parameters) =>
        dictionary.get(locale, key, ...parameters),
    [dictionary, locale],
  );
}
