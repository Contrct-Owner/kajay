import type { TranslationSession } from '@kajay/creator-core';
import { TranslationsPanel } from '@kajay/creator-react';
import { useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';

export interface DesignerTranslationsProps {
  readonly theme: Readonly<Record<string, string>>;
  readonly session: TranslationSession;
}

/**
 * The translation tab, driven the way a host drives it — checklist M4.
 *
 * The import and export controls are **here rather than in the library piece**, and that is
 * the seam working as intended: a download is an anchor with an object URL, an upload is a
 * file input, and both are decisions about a browser that `creator-core` may not make and
 * `creator-react` has no business assuming. The library hands over a rectangle of strings
 * and reads one back; what a host does with it — CSV on disk, XLSX through their own
 * library, a POST to a translation vendor — is theirs.
 */
export function DesignerTranslations({ theme, session }: DesignerTranslationsProps): ReactElement {
  return (
    <section
      className="host-demo__panel"
      aria-label="Designer translations"
      style={theme as CSSProperties}
    >
      <h2>Translations</h2>
      <SheetControls session={session} />
      <TranslationsPanel session={session} />
    </section>
  );
}

function SheetControls({ session }: { readonly session: TranslationSession }): ReactElement {
  const [report, setReport] = useState('');

  return (
    <div className="host-demo__sheet">
      <button
        type="button"
        data-testid="export-csv"
        onClick={() => {
          const url = URL.createObjectURL(new Blob([session.toCsv()], { type: 'text/csv' }));
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = 'translations.csv';
          anchor.click();
          URL.revokeObjectURL(url);
        }}
      >
        Export CSV
      </button>
      <label htmlFor="import-csv">Import CSV</label>
      <input
        id="import-csv"
        type="file"
        accept=".csv,text/csv"
        data-testid="import-csv"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file === undefined) {
            return;
          }
          void file.text().then((text) => {
            const result = session.applyCsv(text);
            setReport(
              `Imported ${String(result.applied)} strings.` +
                (result.unmatched.length > 0
                  ? ` ${String(result.unmatched.length)} no longer exist: ${result.unmatched.join(', ')}`
                  : ''),
            );
          });
        }}
      />
      <p data-testid="import-report" aria-live="polite" aria-atomic="true">
        {report}
      </p>
    </div>
  );
}
