import { localizedTextIn } from '@kajay/creator-core';
import type { DesignSurface, PropertyRow } from '@kajay/creator-core';
import type { SurveyElement } from '@kajay/core';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';

export interface TranslationsFieldProps {
  readonly surface: DesignSurface;
  readonly element: SurveyElement;
  readonly row: PropertyRow;
  readonly id: string;
}

/**
 * Every language of one localizable property — checklist L2.
 *
 * Beside the row's own field rather than instead of it. The field above edits whichever
 * language the survey is being read in, which is what a designer wants ninety-nine times
 * out of a hundred; this is the hundredth, and burying the common case behind a disclosure
 * to make room for it would be the wrong way round.
 *
 * The languages come from the model — see `localesOf`: the ones already written, plus
 * `default`, plus whichever the survey is being read in. A language nobody has used yet is
 * added here, as a **field** rather than as an empty translation: a `{ fr: "" }` in the
 * definition is a translation somebody wrote, and an author clicking "add" has not written
 * one yet.
 *
 * No draft. These are plain strings that commit as they are typed, so what is on screen is
 * what the model holds and an undo is followed for free — the draft L1's fields carry
 * exists for the values that cannot round-trip through their own text, which these can.
 */
export function TranslationsField({
  surface,
  element,
  row,
  id,
}: TranslationsFieldProps): ReactElement {
  const { Input } = useCreatorComponents();
  const [added, setAdded] = useState<readonly string[]>([]);
  const locales = [...row.locales, ...added.filter((locale) => !row.locales.includes(locale))];

  return (
    <details className="kajay-translations">
      <summary className="kajay-translations__summary" data-testid={`translations-${row.name}`}>
        {`${row.title} in other languages`}
      </summary>
      {locales.map((locale) => (
        <div className="kajay-properties__row" key={locale} data-locale={locale}>
          <label className="kajay-properties__label" htmlFor={`${id}-${locale}`}>
            {locale}
          </label>
          <Input
            className="kajay-properties__input"
            id={`${id}-${locale}`}
            data-testid={`translation-${row.name}-${locale}`}
            value={localizedTextIn(row.value, locale)}
            onValueChange={(text) => {
              surface.setLocalized(element, row.name, locale, text);
            }}
          />
        </div>
      ))}
      <AddLocale
        id={id}
        name={row.name}
        onAdd={(locale) => {
          setAdded([...added, locale]);
        }}
      />
    </details>
  );
}

/**
 * A language nobody has written in yet.
 *
 * Adds a **field**, not a translation: `{ fr: "" }` in a definition is something an author
 * wrote, and pressing "add" is not writing it.
 */
function AddLocale({
  id,
  name,
  onAdd,
}: {
  readonly id: string;
  readonly name: string;
  readonly onAdd: (locale: string) => void;
}): ReactElement {
  const { Input, Button } = useCreatorComponents();
  const [tag, setTag] = useState('');

  return (
    <div className="kajay-translations__add">
      <label className="kajay-properties__label" htmlFor={`${id}-add-locale`}>
        Add a language
      </label>
      <Input
        className="kajay-properties__input"
        id={`${id}-add-locale`}
        data-testid={`add-locale-${name}`}
        placeholder="fr"
        value={tag}
        onValueChange={setTag}
      />
      <Button
        className="kajay-translations__add-button"
        data-testid={`add-locale-button-${name}`}
        disabled={tag.trim().length === 0}
        onClick={() => {
          onAdd(tag.trim());
          setTag('');
        }}
      >
        Add
      </Button>
    </div>
  );
}
