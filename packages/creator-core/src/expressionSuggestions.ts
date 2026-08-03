import type { Survey } from '@kajay/core';

/**
 * What an expression may refer to, and what the designer is part-way through typing — L2.
 *
 * **Read off the survey being designed, never off a list kept here.** The questions are its
 * questions, the calculated values are its calculated values, and the functions are the ones
 * its own registry holds — so a host that registered `isServed(...)` sees it offered for
 * exactly the reason it evaluates. A table in the Creator would be right until somebody
 * used the extension seam, which is the case the seam exists for.
 *
 * The completion is over a **token**, not over the whole field. An expression is
 * `{who} = 'yes' and {age} > 18`, so matching a datalist against the field's entire value
 * would offer nothing after the first character — which is why this is a token model and
 * not a `<datalist>`.
 */

export type SuggestionKind = 'question' | 'value' | 'function';

export interface ExpressionSuggestion {
  /** What replaces the token: `{who}` for a reference, `iif(` for a function. */
  readonly insert: string;
  /** What is shown and matched against. */
  readonly label: string;
  readonly kind: SuggestionKind;
}

/** The token under the caret, and what would replace it. */
export interface SuggestionToken {
  /** Where the token starts in the text, and where the caret is. */
  readonly start: number;
  readonly end: number;
  /** What has been typed of it, without any leading brace. */
  readonly text: string;
  /** Whether it opened with `{`, which is what makes it a reference rather than a call. */
  readonly isReference: boolean;
}

/**
 * Everything this survey's expressions may name.
 *
 * `exclude` is the element being edited. A question's own `visibleIf` referring to itself
 * is a cycle the logic engine reports and nothing a designer means to write, so it is not
 * offered — the suggestion list is where a Creator can decline to help somebody do that.
 */
export function expressionSuggestions(
  survey: Survey,
  exclude?: string,
): readonly ExpressionSuggestion[] {
  const references: ExpressionSuggestion[] = [];
  for (const question of survey.questions) {
    if (question.name !== exclude) {
      references.push({ insert: `{${question.name}}`, label: question.name, kind: 'question' });
    }
  }
  for (const value of survey.calculatedValues) {
    references.push({ insert: `{${value.name}}`, label: value.name, kind: 'value' });
  }
  return [
    ...references,
    ...survey.functionNames.map((name) => ({
      insert: `${name}(`,
      label: `${name}()`,
      kind: 'function' as const,
    })),
  ];
}

/**
 * What the caret is part-way through.
 *
 * Scans back from the caret over the characters a name may contain, and one further for an
 * opening brace. A reference is `{` plus a name; anything else is a bare word, which in
 * this language is a function call about to happen.
 *
 * A brace **already closed** ends the token, so a caret sitting after `{who}` is not still
 * typing `who` — otherwise every keystroke after a completed reference would re-offer the
 * thing that had just been accepted.
 */
export function tokenAt(text: string, caret: number): SuggestionToken {
  const at = Math.max(0, Math.min(caret, text.length));
  let start = at;
  while (start > 0 && isNameCharacter(text.charAt(start - 1))) {
    start -= 1;
  }
  const isReference = start > 0 && text.charAt(start - 1) === '{';
  return {
    start: isReference ? start - 1 : start,
    end: at,
    text: text.slice(start, at),
    isReference,
  };
}

function isNameCharacter(character: string): boolean {
  return /[\w$]/u.test(character);
}

/**
 * The suggestions a token would accept, in the order they are offered.
 *
 * Matched on **what the name starts with**, not on what it contains: a designer typing `a`
 * means a name beginning with `a`, and a substring match on a survey with forty questions
 * offers most of them. Case-insensitive, because the expression language's own function
 * names are.
 *
 * Inside braces only references are offered and outside them only functions, which is not
 * a nicety — `{iif(}` is not something the parser accepts, and offering it would be the
 * Creator suggesting an expression it knows to be wrong.
 */
export function matchingSuggestions(
  suggestions: readonly ExpressionSuggestion[],
  token: SuggestionToken,
): readonly ExpressionSuggestion[] {
  const term = token.text.toLowerCase();
  return suggestions.filter((suggestion) => {
    const kindFits = token.isReference ? suggestion.kind !== 'function' : suggestion.kind === 'function';
    return kindFits && suggestion.label.toLowerCase().startsWith(term);
  });
}

/** The text with the token replaced, and where the caret lands after it. */
export function applySuggestion(
  text: string,
  token: SuggestionToken,
  suggestion: ExpressionSuggestion,
): { readonly text: string; readonly caret: number } {
  const before = text.slice(0, token.start);
  const after = text.slice(token.end);
  return {
    text: `${before}${suggestion.insert}${after}`,
    caret: before.length + suggestion.insert.length,
  };
}
