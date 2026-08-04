import type { PreviewSession, ThemeEditorSession } from '@kajay/creator-core';
import { PreviewPanel, ThemeEditorPanel, useThemeVersion } from '@kajay/creator-react';
import { themeVariables } from '@kajay/themes';
import type { Theme } from '@kajay/themes';
import { darkTheme, lightTheme, panellessTheme } from '@kajay/themes';
import type { CSSProperties, ReactElement } from 'react';

export interface DesignerThemeProps {
  readonly session: ThemeEditorSession;
  readonly preview: PreviewSession;
}

const PRESETS: readonly Theme[] = [lightTheme, darkTheme, panellessTheme];

/**
 * The host's claim that this JSON is a theme.
 *
 * The editor works on a plain object by design — `creator-core` has no idea what a theme
 * is — so somebody has to say which format it is in, and the host is the only one who
 * knows. `themeVariables` reads only the fields it recognises and ignores the rest, so the
 * claim costs nothing when it is wrong: an unrecognised key sets no variable.
 */
function asTheme(document: Readonly<Record<string, unknown>>): Theme {
  return { name: '', ...document } as Theme;
}

/**
 * The theme tab, driven the way a host drives it — checklist M5.
 *
 * **The live preview is composition, not a feature the library ships.** The theme editor
 * changes a plain JSON object; this file calls `themeVariables` on it and hands the result
 * to M3's `PreviewPanel`, which is already the real `<Survey>`. So what a designer watches
 * change is the survey a respondent gets, and there is no second preview to disagree with
 * the first.
 *
 * That call is the *host's* because it has to be: `creator-core` and `creator-react` may
 * not import `@kajay/themes` (the architecture check forbids it), which is the same rule
 * that keeps `@kajay/react` from importing it — and the same rule is what lets a host with
 * their own theme format use this editor at all.
 */
export function DesignerTheme({ session, preview }: DesignerThemeProps): ReactElement {
  useThemeVersion(session);
  const variables = themeVariables(asTheme(session.theme));

  return (
    <section
      className="host-demo__panel"
      aria-label="Designer theme"
      style={variables as CSSProperties}
    >
      <h2>Theme</h2>
      <ThemeFile session={session} />
      <div className="host-demo__theme">
        <ThemeEditorPanel session={session} />
        <div>
          <h3>Live preview</h3>
          <PreviewPanel session={preview} surveyProps={{ theme: variables }} />
        </div>
      </div>
    </section>
  );
}

/**
 * Presets, and the theme as a file.
 *
 * Here rather than in the library piece, for M4's reason: a download is an anchor with an
 * object URL and an upload is a file input, and neither is a decision the library may make
 * about a browser.
 */
function ThemeFile({ session }: { readonly session: ThemeEditorSession }): ReactElement {
  return (
    <div className="host-demo__sheet">
      {PRESETS.map((preset) => (
        <button
          key={preset.name}
          type="button"
          data-testid={`theme-preset-${preset.name}`}
          onClick={() => {
            session.applyTheme({ ...preset });
          }}
        >
          {preset.name}
        </button>
      ))}
      <button
        type="button"
        data-testid="theme-export"
        onClick={() => {
          const url = URL.createObjectURL(
            new Blob([session.toJson()], { type: 'application/json' }),
          );
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = 'theme.json';
          anchor.click();
          URL.revokeObjectURL(url);
        }}
      >
        Export theme
      </button>
      <label htmlFor="theme-import">Import theme</label>
      <input
        id="theme-import"
        type="file"
        accept=".json,application/json"
        data-testid="theme-import"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) {
            void file.text().then((text) => session.applyJson(text));
          }
        }}
      />
    </div>
  );
}
