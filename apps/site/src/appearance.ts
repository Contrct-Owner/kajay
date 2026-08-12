/**
 * Which appearance the reader gets, decided before the first paint — checklist P14.
 *
 * **The theme used to be applied in an effect, which is after the browser has already
 * painted.** So every reader who prefers dark got a white page first and the real one a
 * moment later, on every navigation that reloaded the document — reported as the
 * documentation "flashing white on load", and true of every page on the site.
 *
 * There is no way to render this on the server: the choice lives in the reader's
 * `localStorage` or their operating system, and the server has neither. The only place the
 * answer can be applied before a paint is a **blocking script in the head**, which is why
 * this exists as a string of source rather than as a module the bundler would defer.
 *
 * Keeping it here rather than inline in the document means the logic is written once and
 * read twice — {@link APPEARANCE_SCRIPT} runs it before paint, and `ThemeToggle` imports
 * the same constants rather than restating the key and the values it stores.
 */

/** Where a pressed choice is remembered. Shared, so the two readers cannot drift apart. */
export const APPEARANCE_STORAGE_KEY = 'kajay-site-appearance';

export type Appearance = 'light' | 'dark';

/**
 * The two things a theme change touches, and the reason the demonstration is worth making.
 *
 * shadcn's dark mode is the class `dark` on the root element; Kajay's is the attribute
 * `data-kajay-theme` ([ADR-0008](../../../../docs/adr/0008-no-surveyjs-theme-import.md)).
 * Setting both is the whole of the bridge between them — a survey engine whose theming had
 * to be *wired* to the host's would be one you could not drop into an application that
 * already had a dark mode.
 */
export function applyAppearance(appearance: Appearance): void {
  const root = globalThis.document.documentElement;
  root.classList.toggle('dark', appearance === 'dark');
  root.dataset['kajayTheme'] = appearance;
}

/**
 * The decision, as source the document can run before it paints.
 *
 * **Written out as text rather than derived from the function above**, because it has to
 * survive arriving inside a `<script>` — a function stringified by the bundler carries
 * whatever names the minifier gave it and whatever helpers it was compiled against, and
 * neither exists on the page at the moment this runs. What that costs is one duplicated
 * pair of names, the class and the attribute; what it buys is a script that cannot be
 * broken by a change to how the app is bundled.
 *
 * Wrapped in `try` because it runs before anything else on the page: a reader whose browser
 * refuses `localStorage` — private mode, blocked cookies — should get a page in the wrong
 * colours, not no page at all.
 */
export const APPEARANCE_SCRIPT = `
try {
  var stored = localStorage.getItem(${JSON.stringify(APPEARANCE_STORAGE_KEY)});
  var dark = stored === 'dark' || (stored !== 'light'
    && window.matchMedia('(prefers-color-scheme: dark)').matches);
  var root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.dataset.kajayTheme = dark ? 'dark' : 'light';
} catch (error) {}
`.trim();
