import { MetadataRegistry, createDefaultFunctionRegistry, parseSurvey, registerBuiltInTypes } from '@kajay/core';
import type { Survey, SurveyDefinition } from '@kajay/core';
import {
  applySuggestion,
  expressionSuggestions,
  matchingSuggestions,
  tokenAt,
} from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

/** What an expression may say, and what is part-way typed — checklist L2. */
const BASIC: SurveyDefinition = {
  calculatedValues: [{ name: 'total', expression: '1 + 1' }],
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'age' },
        { type: 'text', name: 'agent' },
        { type: 'text', name: 'who' },
      ],
    },
  ],
};

function survey(definition: SurveyDefinition = BASIC): Survey {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return parseSurvey(definition, registry).survey;
}

function labels(suggestions: readonly { readonly label: string }[]): readonly string[] {
  return suggestions.map((suggestion) => suggestion.label);
}

describe('parity/L2-suggestions', () => {
  test('the names come from the survey, not from a list kept here', () => {
    const offered = labels(expressionSuggestions(survey()));

    expect(offered).toContain('age');
    expect(offered).toContain('total');
    expect(offered).toContain('iif()');
  });

  test('a host’s own function is offered for the same reason it evaluates', () => {
    const functions = createDefaultFunctionRegistry();
    functions.register('isServed', () => true);
    const model = survey();
    model.configure({ functions });

    // Read off the registry in force. A table in the Creator would be right until
    // somebody used the extension seam, which is the case the seam exists for.
    expect(labels(expressionSuggestions(model))).toContain('isserved()');
  });

  test('a question is not offered its own name', () => {
    const offered = labels(expressionSuggestions(survey(), 'age'));

    // A `visibleIf` referring to its own question is a cycle the logic engine reports and
    // nothing a designer means to write.
    expect(offered).not.toContain('age');
    expect(offered).toContain('agent');
  });
});

describe('parity/L2-token', () => {
  test('a brace opens a reference and a bare word is a call', () => {
    expect(tokenAt('{ag', 3)).toEqual({ start: 0, end: 3, text: 'ag', isReference: true });
    expect(tokenAt('1 + su', 6)).toEqual({ start: 4, end: 6, text: 'su', isReference: false });
  });

  test('a closed reference is finished with', () => {
    // Without this, every keystroke after a completed reference would re-offer the thing
    // that had just been accepted.
    expect(tokenAt('{who} ', 6).text).toBe('');
    expect(tokenAt('{who}', 5).isReference).toBe(false);
  });

  test('what is offered matches the start of the name', () => {
    const all = expressionSuggestions(survey());

    // Not a substring match: a designer typing `a` means a name beginning with `a`, and
    // a survey of forty questions would otherwise offer most of them.
    expect(labels(matchingSuggestions(all, tokenAt('{age', 4)))).toEqual(['age', 'agent']);
    // `ge` is inside both names and starts neither, so it offers nothing.
    expect(labels(matchingSuggestions(all, tokenAt('{ge', 3)))).toEqual([]);
  });

  test('braces offer references and bare words offer functions, never both', () => {
    const all = expressionSuggestions(survey());

    // `{iif(}` is not something the parser accepts, so offering it would be the Creator
    // suggesting an expression it knows to be wrong.
    expect(labels(matchingSuggestions(all, tokenAt('{i', 2)))).not.toContain('iif()');
    expect(labels(matchingSuggestions(all, tokenAt('i', 1)))).not.toContain('age');
    expect(labels(matchingSuggestions(all, tokenAt('i', 1)))).toContain('iif()');
  });

  test('accepting replaces the token and says where the caret lands', () => {
    const all = expressionSuggestions(survey());
    const token = tokenAt("{who} = 'yes' and {ag", 21);
    const chosen = matchingSuggestions(all, token)[0]!;

    expect(applySuggestion("{who} = 'yes' and {ag", token, chosen)).toEqual({
      text: "{who} = 'yes' and {age}",
      caret: 23,
    });
  });
});
