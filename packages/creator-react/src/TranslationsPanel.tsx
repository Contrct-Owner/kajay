import { DEFAULT_LOCALE } from '@kajay/creator-core';
import type { TranslationEntry, TranslationSession } from '@kajay/creator-core';
import { useCallback, useState, useSyncExternalStore } from 'react';
import type { ReactElement } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';
import { useCreatorText } from './CreatorStringsContext.js';

export interface TranslationsPanelProps {
  readonly session: TranslationSession;
  readonly className?: string;
}

/**
 * Every string in the survey, in every language — checklist M4.
 *
 * A piece ([ADR-0021](../../../docs/adr/0021-creator-composition.md)): it takes the session
 * and holds nothing but the language somebody is typing into the "add" box.
 *
 * **A real `<table>`**, because this is one: a screen reader announces "row 4, column
 * French" from a table and announces nothing at all from a grid of divs, and a translator
 * working down a column is exactly the person who needs that. The row header is the
 * *context* rather than the key — the key is machine identity and belongs in the file, not
 * on screen in front of somebody translating.
 */
export function TranslationsPanel({ session, className }: TranslationsPanelProps): ReactElement {
  useTranslationVersion(session);
  const text = useCreatorText();
  const entries = session.entries;
  const locales = session.locales;

  return (
    <div className={joinClasses('kajay-translations-panel', className)}>
      <TranslationControls session={session} />
      <table className="kajay-translations-panel__table" data-testid="translations-table">
        <caption className="kajay-translations-panel__caption">
          {text('translationCount', entries.length)}
        </caption>
        <thead>
          <tr>
            <th scope="col">{text('translationString')}</th>
            {locales.map((locale) => (
              <th scope="col" key={locale} data-testid={`translations-column-${locale}`}>
                {locale}
                <span className="kajay-translations-panel__missing">
                  {` ${text('translationMissing', session.missingIn(locale))}`}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <TranslationRow key={entry.key} session={session} entry={entry} locales={locales} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TranslationRow({
  session,
  entry,
  locales,
}: {
  readonly session: TranslationSession;
  readonly entry: TranslationEntry;
  readonly locales: readonly string[];
}): ReactElement {
  const { Input } = useCreatorComponents();
  const text = useCreatorText();

  return (
    <tr>
      <th scope="row" className="kajay-translations-panel__context">
        {entry.context}
      </th>
      {locales.map((locale) => (
        <td key={locale}>
          <Input
            className="kajay-translations-panel__input"
            // Labelled by the two headers the cell sits under, which is what a table is
            // *for* — the alternative is a visually hidden label repeating both.
            aria-label={text('translationCell', entry.context, locale)}
            data-testid={`translation-cell-${entry.key}-${locale}`}
            value={session.textIn(entry, locale)}
            onValueChange={(value) => {
              session.setText(entry, locale, value);
            }}
          />
        </td>
      ))}
    </tr>
  );
}

/** Adding a language, machine-translating one, and what happened. */
function TranslationControls({
  session,
}: {
  readonly session: TranslationSession;
}): ReactElement {
  const [report, setReport] = useState('');

  return (
    <div className="kajay-translations-panel__controls">
      <AddLanguage session={session} />
      <MachineTranslate session={session} onReport={setReport} />
      <p
        className="kajay-translations-panel__report"
        aria-live="polite"
        aria-atomic="true"
        data-testid="translations-report"
      >
        {report}
      </p>
    </div>
  );
}

/** Opens a column for a language nobody has written in yet. */
function AddLanguage({ session }: { readonly session: TranslationSession }): ReactElement {
  const { Button, Input } = useCreatorComponents();
  const text = useCreatorText();
  const [locale, setLocale] = useState('');

  return (
    <>
      <Input
        className="kajay-translations-panel__locale"
        aria-label={text('translationLanguageToAdd')}
        data-testid="add-locale"
        value={locale}
        placeholder="fr"
        onValueChange={setLocale}
      />
      <Button
        data-testid="add-locale-button"
        disabled={locale.trim().length === 0}
        onClick={() => {
          // A column, not a translation — writing `{ fr: "" }` into every string would put
          // a hundred empty translations in the definition that nobody authored.
          if (session.addLocale(locale)) {
            setLocale('');
          }
        }}
      >
        {text('translationAddLanguage')}
      </Button>
    </>
  );
}

/**
 * Fills a language in from the host's service.
 *
 * The button says what it is doing while it does it, because a translation service is a
 * network call and a button that looks idle for four seconds gets pressed twice.
 */
function MachineTranslate({
  session,
  onReport,
}: {
  readonly session: TranslationSession;
  readonly onReport: (report: string) => void;
}): ReactElement {
  const { Button, Select } = useCreatorComponents();
  const text = useCreatorText();
  const [target, setTarget] = useState('');
  const targets = session.locales.filter((name) => name !== DEFAULT_LOCALE);
  const chosen = target.length > 0 ? target : (targets[0] ?? '');

  return (
    <>
      <Select
        className="kajay-translations-panel__target"
        aria-label={text('translationTarget')}
        data-testid="translate-target"
        value={chosen}
        options={targets.map((name) => ({ value: name, label: name }))}
        disabled={targets.length === 0}
        onValueChange={setTarget}
      />
      <Button
        data-testid="translate-button"
        disabled={session.isTranslating || chosen.length === 0}
        onClick={() => {
          void session.translateInto(chosen).then((result) => {
            onReport(result.error ?? text('translationFilled', result.filled, chosen));
          });
        }}
      >
        {session.isTranslating ? text('translationTranslating') : text('translationTranslate')}
      </Button>
    </>
  );
}

/** Re-renders when the survey, the columns or a translation changes. */
export function useTranslationVersion(session: TranslationSession): number {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => session.onChanged.add(onStoreChange),
    [session],
  );
  const getSnapshot = useCallback((): number => session.version, [session]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

function joinClasses(base: string, extra: string | undefined): string {
  return extra === undefined || extra.length === 0 ? base : `${base} ${extra}`;
}
