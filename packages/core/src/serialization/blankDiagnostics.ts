import { isLocalizedText } from '../model/localizedText.js';
import { blankNamesIn } from '../model/parseBlankTemplate.js';
import type { Diagnostic } from './Diagnostic.js';

/** What a fill-in-the-blank question offers this walk, without the model reaching back. */
export interface BlankTemplateQuestion {
  readonly name: string;
  /** The authored `template`, which may be one string or one per locale. */
  readonly template: unknown;
  readonly blanks: readonly DeclaredBlank[];
}

/** One declared blank, and whether its type may sit in a line of prose. */
export interface DeclaredBlank {
  readonly name: string;
  readonly type: string;
  readonly allowsInline: boolean;
}

/**
 * Everything wrong with a sentence and the blanks it names — checklist C13, ADR-0048.
 *
 * A walk over finished questions rather than a hook on each property, because every rule
 * here compares the template against the collection beside it and neither is complete
 * until both have been read — the same reason endpoint diagnostics run after the tree
 * exists. Reported against the question, which is where an author can act on it.
 */
export function collectBlankDiagnostics(
  questions: readonly BlankTemplateQuestion[],
): readonly Diagnostic[] {
  return questions.flatMap((question) => [
    ...undeclared(question),
    ...unpositioned(question),
    ...notInline(question),
    ...localeMismatch(question),
  ]);
}

/**
 * A `[[name]]` nobody declared.
 *
 * **Error**, because there is nothing to draw: an input with no label, no marking and
 * nowhere to store an answer is worse than the gap left in the prose, so the renderer
 * skips it and the respondent silently loses a question the author thought they asked.
 */
function undeclared(question: BlankTemplateQuestion): readonly Diagnostic[] {
  const declared = new Set(question.blanks.map((blank) => blank.name));
  return namesIn(defaultTemplate(question.template))
    .filter((name) => !declared.has(name))
    .map((name) => ({
      severity: 'error' as const,
      code: 'undeclared-blank' as const,
      message:
        `"${question.name}" positions a blank named ${JSON.stringify(name)}, which its `
        + 'blanks do not declare. Add it, or remove the marker.',
      path: `/${question.name}`,
    }));
}

/**
 * A declared blank the sentence never positions.
 *
 * **Warning**, not error: a respondent simply never sees it, so nothing they do is
 * affected. It is still almost always a mistake — a renamed marker, or a translation
 * pasted over the default — and saying so costs an author nothing.
 */
function unpositioned(question: BlankTemplateQuestion): readonly Diagnostic[] {
  const positioned = new Set(namesIn(defaultTemplate(question.template)));
  return question.blanks
    .map((blank) => blank.name)
    .filter((name) => !positioned.has(name))
    .map((name) => ({
      severity: 'warning' as const,
      code: 'unpositioned-blank' as const,
      message:
        `"${question.name}" declares a blank named ${JSON.stringify(name)} that its `
        + 'template never positions. It will not be shown.',
      path: `/${question.name}`,
    }));
}

/**
 * A blank whose type cannot sit in a line of prose.
 *
 * **Error**, because nothing can draw it: a matrix in the middle of a clause is not a
 * layout decision but a mistake, and the respondent would silently lose a field the author
 * placed. Whether a type may go inline is the registry's answer rather than a list kept
 * here, so a host's own type can opt in.
 */
function notInline(question: BlankTemplateQuestion): readonly Diagnostic[] {
  return question.blanks
    .filter((blank) => !blank.allowsInline)
    .map((blank) => ({
      severity: 'error' as const,
      code: 'non-inline-blank' as const,
      message:
        `"${question.name}" positions a blank of type ${JSON.stringify(blank.type)}, which `
        + 'cannot sit inside a sentence. Use a type that can, or ask a separate question.',
      path: `/${question.name}`,
    }));
}

/**
 * A translation that names a different set of blanks than the default.
 *
 * **Error, and the reason the template may be translated at all.** Word order moves
 * between languages, so a translator has to move a marker inside the sentence — and the
 * same freedom lets them rename, drop or invent one. The answer keys would then depend on
 * the language the respondent happened to read, and a response recorded in French would
 * carry keys no other locale produces. Nothing downstream could tell that from a
 * respondent who left a gap empty, which is why this is not a warning.
 */
function localeMismatch(question: BlankTemplateQuestion): readonly Diagnostic[] {
  const template = question.template;
  if (!isLocalizedText(template)) {
    return [];
  }
  const expected = namesIn(template.default ?? '');
  return Object.entries(template)
    .filter(([locale]) => locale !== 'default')
    .filter(([, text]) => !sameNames(namesIn(text ?? ''), expected))
    .map(([locale]) => ({
      severity: 'error' as const,
      code: 'locale-blank-mismatch' as const,
      message:
        `"${question.name}" names different blanks in ${JSON.stringify(locale)} than in `
        + 'its default template. A translation may move a blank but not rename, add or drop one.',
      path: `/${question.name}`,
    }));
}

/** The default wording, which every translation is measured against. */
function defaultTemplate(template: unknown): string {
  if (typeof template === 'string') {
    return template;
  }
  return isLocalizedText(template) ? (template.default ?? '') : '';
}

function namesIn(template: string): readonly string[] {
  return blankNamesIn(template);
}

/** Set equality: a translation may reorder its blanks, which is the whole point. */
function sameNames(actual: readonly string[], expected: readonly string[]): boolean {
  const wanted = new Set(expected);
  return actual.length === wanted.size && actual.every((name) => wanted.has(name));
}
