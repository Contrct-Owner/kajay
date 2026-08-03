/**
 * The theme format, and the presets built with it — checklist I2 and I3.
 *
 * A theme is **plain JSON that maps onto CSS custom properties**, and nothing else. That
 * is the whole design: `@kajay/themes` computes a variable map, a host hands it to the
 * renderer, and the renderer sets it on the survey root. No package imports another to
 * make it work — `@kajay/react` is not allowed to depend on this one — and a host that
 * would rather write CSS can ignore every line of this file and override the same
 * variables in a stylesheet.
 *
 * Deliberately **not** SurveyJS's theme format ([ADR-0008](../../../docs/adr/0008-css-variable-token-system.md)):
 * a theme file is a mapping onto variable names, and accepting theirs would tie ours to
 * theirs permanently.
 */

/** How a survey is framed: boxed panels, or nothing but the questions. */
export type PanelMode = 'panels' | 'panelless';

/** Overall scale. Three named sizes rather than a number, because they are a decision. */
export type ThemeSize = 'compact' | 'regular' | 'roomy';

/** The colours a theme names. Everything else is derived or left to CSS. */
export interface ThemePalette {
  readonly surface?: string;
  readonly text?: string;
  readonly muted?: string;
  readonly accent?: string;
  /**
   * What sits *on* the accent — text on the primary button, on a selected rating.
   *
   * Its own entry because it does not follow from the accent. A dark theme lightens the
   * accent so it shows against a dark surface, and white text on a light accent is
   * unreadable: the shipped dark preset managed 2.51:1 before this existed, which is a
   * primary button nobody with low vision could read.
   */
  readonly onAccent?: string;
  readonly border?: string;
  readonly danger?: string;
  /** Behind the survey rather than inside it. Distinct from `surface`. */
  readonly background?: string;
}

/** A picture behind the survey, and how much of it shows through. */
export interface ThemeBackdrop {
  readonly image?: string;
  /** 0 to 1. Applied to the image, never to the text in front of it. */
  readonly opacity?: number;
}

export interface Theme {
  readonly name: string;
  readonly palette?: ThemePalette;
  readonly panelMode?: PanelMode;
  readonly size?: ThemeSize;
  /** Corner radius, as a CSS length. */
  readonly cornerRadius?: string;
  readonly fontFamily?: string;
  readonly backdrop?: ThemeBackdrop;
  /**
   * Anything the format does not name, written straight through.
   *
   * The escape hatch that keeps the format from having to grow a field for every idea:
   * a host with one unusual variable sets it here rather than waiting for a release.
   * Applied last, so it wins over everything computed above.
   */
  readonly variables?: Readonly<Record<string, string>>;
}

const SPACING: Readonly<Record<ThemeSize, string>> = {
  compact: '12px',
  regular: '16px',
  roomy: '22px',
};

/** The variable a palette entry sets. Absent entries set nothing at all. */
const PALETTE_VARIABLES: readonly (readonly [keyof ThemePalette, string])[] = [
  ['surface', '--kajay-color-surface'],
  ['text', '--kajay-color-text'],
  ['muted', '--kajay-color-muted'],
  ['accent', '--kajay-color-accent'],
  ['onAccent', '--kajay-color-on-accent'],
  ['border', '--kajay-color-border'],
  ['danger', '--kajay-color-danger'],
  ['background', '--kajay-color-background'],
];

/**
 * The CSS custom properties a theme sets.
 *
 * Pure, and that is the point: a theme can be computed on a server, stored in a
 * database, diffed in a test, or handed to a renderer, and it is the same map every
 * time. Only what the theme actually names appears — an absent field leaves the
 * stylesheet's own default alone rather than overwriting it with a guess.
 */
export function themeVariables(theme: Theme): Readonly<Record<string, string>> {
  const variables: Record<string, string> = {};
  for (const [key, variable] of PALETTE_VARIABLES) {
    const value = theme.palette?.[key];
    if (value !== undefined) {
      variables[variable] = value;
    }
  }
  if (theme.size !== undefined) {
    variables['--kajay-spacing'] = SPACING[theme.size];
  }
  if (theme.cornerRadius !== undefined) {
    variables['--kajay-radius'] = theme.cornerRadius;
  }
  if (theme.fontFamily !== undefined) {
    variables['--kajay-font-family'] = theme.fontFamily;
  }
  if (theme.panelMode !== undefined) {
    // A border width rather than a flag, so `panelless` is the *absence* of the frame
    // rather than a second set of rules for every panel to remember.
    variables['--kajay-panel-border-width'] = theme.panelMode === 'panelless' ? '0' : '1px';
    variables['--kajay-panel-padding'] =
      theme.panelMode === 'panelless' ? '0' : 'var(--kajay-spacing)';
  }
  if (theme.backdrop?.image !== undefined) {
    variables['--kajay-backdrop-image'] = `url("${theme.backdrop.image}")`;
  }
  if (theme.backdrop?.opacity !== undefined) {
    variables['--kajay-backdrop-opacity'] = String(theme.backdrop.opacity);
  }
  return { ...variables, ...theme.variables };
}

export const lightTheme: Theme = {
  name: 'light',
  palette: {
    surface: '#ffffff',
    text: '#101828',
    muted: '#667085',
    accent: '#2f6feb',
    onAccent: '#ffffff',
    border: '#d0d5dd',
    danger: '#b42318',
    background: '#f6f8fb',
  },
  panelMode: 'panels',
  size: 'regular',
  cornerRadius: '8px',
};

export const darkTheme: Theme = {
  name: 'dark',
  palette: {
    surface: '#12161f',
    text: '#e7ecf3',
    muted: '#98a2b3',
    accent: '#7aa2f7',
    onAccent: '#0b0e14',
    border: '#2b3444',
    danger: '#f97066',
    background: '#0b0e14',
  },
  panelMode: 'panels',
  size: 'regular',
  cornerRadius: '8px',
};

/**
 * The same colours with the frames taken away.
 *
 * A preset rather than an option on the others, because "panelless" changes what the
 * survey *is* to look at rather than what colour it is, and an author picks one theme.
 */
export const panellessTheme: Theme = {
  ...lightTheme,
  name: 'panelless',
  panelMode: 'panelless',
};

export const themes: readonly Theme[] = [lightTheme, darkTheme, panellessTheme];
