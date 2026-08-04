import { humanizePropertyName } from './propertyGrid.js';

/**
 * What a theme editor draws, and what it draws it out of — checklist M5.
 *
 * **A table here, not an import.** `creator-core` may depend on `@kajay/core` and nothing
 * else, so it cannot ask `@kajay/themes` what a theme looks like — and it should not want
 * to: a theme is a fact about one host's deployment rather than about the survey
 * ([ADR-0008](../../../docs/adr/0008-css-variable-token-system.md)), and a Creator that
 * imported the shipped format would make every host's own format second-class.
 *
 * So this is `builtInToolbox`'s shape one more time: a table describing the format the
 * library ships, and **a key the table has never heard of still appears** — under a field
 * derived from the value it holds. A host with their own theme format passes their own
 * fields; a host with an extra variable in the shipped one needs to do nothing at all.
 */

/**
 * How one entry of a theme is edited.
 *
 * `color` and `length` are both text — a CSS colour is `#0af`, `oklch(…)` or a variable
 * reference, and a length is `8px` or `0.5rem` — and they differ in what is drawn beside
 * the field. `choice` is the one kind the value alone could never imply.
 */
export type ThemeFieldKind = 'color' | 'length' | 'text' | 'number' | 'choice';

export interface ThemeField {
  /** Dotted path into the theme: `palette.accent`, `backdrop.opacity`. */
  readonly path: string;
  readonly kind: ThemeFieldKind;
  /** The values a `choice` offers. Ignored for every other kind. */
  readonly choices?: readonly string[];
  readonly description?: string;
}

/** A field, resolved against a theme and ready to draw. */
export interface ThemeRow extends ThemeField {
  /** The label, derived from the last path segment — L1's rule, and for its reasons. */
  readonly title: string;
  /** What the theme says. Empty when the theme does not name it. */
  readonly text: string;
  /** Whether the theme names it at all — see {@link themeRowsFor}. */
  readonly isSet: boolean;
}

/**
 * The format `@kajay/themes` ships, described.
 *
 * Ordered as a designer works: the colours first because that is what a theme *is* to
 * anybody looking at one, then the shape of the frame, then the picture behind it.
 */
export const BUILT_IN_THEME_FIELDS: readonly ThemeField[] = [
  { path: 'palette.background', kind: 'color', description: 'Behind the survey, not inside it.' },
  { path: 'palette.surface', kind: 'color' },
  { path: 'palette.text', kind: 'color' },
  { path: 'palette.muted', kind: 'color' },
  { path: 'palette.accent', kind: 'color' },
  {
    path: 'palette.onAccent',
    kind: 'color',
    description: 'What sits on the accent. It does not follow from the accent itself.',
  },
  { path: 'palette.border', kind: 'color' },
  { path: 'palette.danger', kind: 'color' },
  { path: 'panelMode', kind: 'choice', choices: ['panels', 'panelless'] },
  { path: 'size', kind: 'choice', choices: ['compact', 'regular', 'roomy'] },
  { path: 'cornerRadius', kind: 'length' },
  { path: 'fontFamily', kind: 'text' },
  { path: 'backdrop.image', kind: 'text', description: 'A URL. The picture behind the survey.' },
  { path: 'backdrop.opacity', kind: 'number', description: '0 to 1, applied to the picture only.' },
];

/** A theme, as the plain JSON it is. */
export type ThemeDocument = Readonly<Record<string, unknown>>;

/*
 * The parameters below are called `theme`, never `document`.
 *
 * A core package may not touch the DOM and the architecture check enforces it by looking
 * for the identifier — which cannot tell a parameter from the global, and neither can a
 * reader coming to the file cold. K6 fixed that checker once for a private field it had no
 * business matching; this is the other side of the same rule, and the right answer here is
 * the better name rather than a second carve-out.
 */

/**
 * Every field to draw: the declared ones, then anything the theme holds that they
 * missed.
 *
 * The second half is the claim. A host who adds `palette.highlight` to their own theme
 * format, or sets one variable the shipped table has never heard of, sees it here — the
 * same courtesy K1's toolbox extends to a type nobody listed. What is *not* included is
 * `name`, which identifies the theme rather than describing it, and `variables`, which is
 * an escape hatch holding raw CSS custom properties and is a JSON field rather than a row.
 */
export function themeRowsFor(
  theme: ThemeDocument,
  fields: readonly ThemeField[] = BUILT_IN_THEME_FIELDS,
): readonly ThemeRow[] {
  const declared = new Set(fields.map((field) => field.path));
  const extra = pathsIn(theme).filter(
    (path) => !declared.has(path) && !RESERVED.has(path.split('.')[0] ?? ''),
  );
  return [...fields, ...extra.map((path) => inferField(theme, path))].map((field) =>
    Object.assign({}, field, {
      title: humanizePropertyName(field.path.split('.').at(-1) ?? field.path),
      text: textAt(theme, field.path),
      isSet: valueAt(theme, field.path) !== undefined,
    }),
  );
}

/** Not rows: one names the theme, and the other is raw CSS nobody should type in a grid. */
const RESERVED: ReadonlySet<string> = new Set(['name', 'variables']);

function inferField(theme: ThemeDocument, path: string): ThemeField {
  return { path, kind: typeof valueAt(theme, path) === 'number' ? 'number' : 'text' };
}

/** Every leaf path in the theme, one level of nesting deep, as a theme is. */
function pathsIn(theme: ThemeDocument): readonly string[] {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(theme)) {
    if (isObject(value)) {
      paths.push(...Object.keys(value).map((child) => `${key}.${child}`));
    } else {
      paths.push(key);
    }
  }
  return paths;
}

/** What the theme holds at a dotted path, or `undefined`. */
export function valueAt(theme: ThemeDocument, path: string): unknown {
  let current: unknown = theme;
  for (const segment of path.split('.')) {
    if (!isObject(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function textAt(theme: ThemeDocument, path: string): string {
  const value = valueAt(theme, path);
  return value === undefined || value === null ? '' : String(value);
}

/**
 * The same theme with one path set, or **removed** when the text is empty.
 *
 * Removed, not blanked, and that is I2's rule rather than a nicety: *what a theme does not
 * name, it does not set*. A `cornerRadius` of `""` would reach the renderer as an empty CSS
 * variable and override the stylesheet's own default with nothing; an absent one leaves it
 * alone. Clearing a field in an editor means the second thing.
 *
 * A branch left empty by a removal goes with it, so a theme that never had a `backdrop`
 * and one whose backdrop was cleared are the same theme — otherwise exporting would
 * carry `"backdrop": {}` around forever.
 */
export function withValueAt(
  theme: ThemeDocument,
  path: string,
  value: string | number | undefined,
): ThemeDocument {
  const [head, ...rest] = path.split('.');
  if (head === undefined) {
    return theme;
  }
  if (rest.length === 0) {
    return withKey(theme, head, value);
  }
  const branch = theme[head];
  const nested = withValueAt(isObject(branch) ? branch : {}, rest.join('.'), value);
  return withKey(theme, head, Object.keys(nested).length === 0 ? undefined : nested);
}

function withKey(
  theme: ThemeDocument,
  key: string,
  value: unknown,
): ThemeDocument {
  const next: Record<string, unknown> = { ...theme };
  if (value === undefined || value === '') {
    delete next[key];
  } else {
    next[key] = value;
  }
  return next;
}

function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
