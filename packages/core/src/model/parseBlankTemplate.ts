/** One piece of a template: prose, or a gap the respondent types into. */
export type TemplateSegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'blank'; readonly name: string };

/**
 * A name `[[...]]` may carry — checklist C13,
 * [ADR-0048](../../../../docs/adr/0048-fill-in-the-blank-question.md).
 *
 * The same shape a reference path segment has, because a blank's answer lives in an object
 * under the question's name and is reached from an expression as `{geography.capital}`. A
 * name containing a dot or a bracket would be unreachable from the language that is
 * supposed to read it.
 */
const BLANK = /\[\[([A-Za-z_][A-Za-z0-9_]*)\]\]/gu;

/**
 * Splits prose into the text around its blanks and the blanks themselves.
 *
 * **`[[` opens a blank only when a valid name and `]]` follow.** Anything else is text, so
 * prose that happens to contain a bracket pair needs no escape — and an escape character
 * is exactly what this avoids, because it would land in authored prose and in every
 * translator's copy of it to serve a case no assessment has. The stated cost is that a
 * literal `[[capital]]` cannot be written.
 *
 * Order is preserved and text is never merged across a blank, because the renderer draws
 * the pieces in sequence and a translator is free to move a marker anywhere in the
 * sentence — including to the very start or end, which is why empty runs are dropped
 * rather than emitted as empty text.
 */
export function parseBlankTemplate(template: string): readonly TemplateSegment[] {
  const segments: TemplateSegment[] = [];
  let index = 0;
  for (const match of template.matchAll(BLANK)) {
    const name = match[1];
    if (name === undefined) {
      continue;
    }
    if (match.index > index) {
      segments.push({ kind: 'text', text: template.slice(index, match.index) });
    }
    segments.push({ kind: 'blank', name });
    index = match.index + match[0].length;
  }
  if (index < template.length) {
    segments.push({ kind: 'text', text: template.slice(index) });
  }
  return segments;
}

/**
 * Every blank the template positions, in the order it positions them, without repeats.
 *
 * Separate from the segments because the callers differ: a renderer walks the sequence,
 * while the diagnostics and the Creator ask only *which* names a template names.
 */
export function blankNamesIn(template: string): readonly string[] {
  return [
    ...new Set(
      parseBlankTemplate(template)
        .filter((segment) => segment.kind === 'blank')
        .map((segment) => segment.name),
    ),
  ];
}
