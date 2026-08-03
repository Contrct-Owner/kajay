const PLACEHOLDER: RegExp = /\{([^{}]+)\}/gu;

/**
 * Substitutes `{name}` placeholders, leaving the caller to encode what goes in.
 *
 * The encoding is the caller's because it depends entirely on where the result lands:
 * a value going into a URL needs percent-encoding, and the same value going into markup
 * needs HTML escaping. One shared substitution with one shared escape would be right in
 * one place and a defect in the other.
 */
export function interpolate(template: string, render: (name: string) => string): string {
  return template.replaceAll(PLACEHOLDER, (_match, reference: string) => render(reference.trim()));
}

/**
 * The names a template refers to, in the order it refers to them.
 *
 * Separate from resolving them, because a caller that needs to *declare* what a
 * template depends on — the dependency graph, for a URL — must ask before any value
 * exists to substitute.
 */
export function placeholderNames(template: string): readonly string[] {
  return [...template.matchAll(PLACEHOLDER)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1].trim()],
  );
}

/**
 * Substitutes placeholders into markup, escaping every value it puts there.
 *
 * **The template and the values have different owners.** The markup is the author's,
 * and rendering it as markup is the whole point of an `html` element — it is code at
 * the host's own level of trust. What a placeholder resolves to is usually a
 * *respondent's* answer, which is not trusted by anything, and dropping it in raw would
 * turn "type your name" into stored cross-site scripting on the completed page. So the
 * template stays markup and the values become text.
 */
export function interpolateHtml(template: string, resolve: (name: string) => unknown): string {
  return interpolate(template, (name) => escapeHtml(displayValue(resolve(name))));
}

/** Empty for nothing, and a list joined for an array — what a reader would expect. */
function displayValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return Array.isArray(value) ? value.map((entry) => displayValue(entry)).join(', ') : String(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
