/**
 * Theme data. Our own CSS-variable token namespace (ADR-0008) — deliberately not
 * SurveyJS-compatible, because a theme file is a mapping onto variable names and
 * accepting theirs would lock ours to theirs permanently.
 *
 * Phase 2 turns this into the full theme JSON format. Phase 0 ships the token contract
 * and the stylesheet that implements it.
 */
export interface Theme {
  readonly name: string;
  readonly variables: Readonly<Record<string, string>>;
}

export const lightTheme: Theme = {
  name: 'light',
  variables: {
    '--kajay-color-surface': '#ffffff',
    '--kajay-color-text': '#101828',
    '--kajay-color-muted': '#667085',
    '--kajay-color-accent': '#2f6feb',
    '--kajay-color-border': '#d0d5dd',
    '--kajay-radius': '8px',
    '--kajay-spacing': '16px',
  },
};

export const darkTheme: Theme = {
  name: 'dark',
  variables: {
    '--kajay-color-surface': '#12161f',
    '--kajay-color-text': '#e7ecf3',
    '--kajay-color-muted': '#98a2b3',
    '--kajay-color-accent': '#7aa2f7',
    '--kajay-color-border': '#2b3444',
    '--kajay-radius': '8px',
    '--kajay-spacing': '16px',
  },
};

export const themes: readonly Theme[] = [lightTheme, darkTheme];
