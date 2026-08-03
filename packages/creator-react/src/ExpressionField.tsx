import {
  applySuggestion,
  expressionSuggestions,
  matchingSuggestions,
  tokenAt,
} from '@kajay/creator-core';
import type { DesignSurface, ExpressionSuggestion } from '@kajay/creator-core';
import { useState } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';

export interface ExpressionFieldProps {
  readonly surface: DesignSurface;
  /** The element being edited, so its own name is not offered back to it. */
  readonly owner: string;
  readonly id: string;
  readonly hint: string | undefined;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly 'data-testid'?: string;
}

/**
 * A text field that knows what a survey's expressions may say — checklist L2.
 *
 * **A combobox, not a `<datalist>`.** An expression is `{who} = 'yes' and {age} > 18`, and a
 * datalist matches its options against the field's *entire* value — so it would stop
 * offering anything after the first character. Completion here is over a **token**, which
 * is a model concept in `creator-core` and testable without a DOM.
 *
 * The ARIA 1.2 combobox pattern, and focus never moves: the input keeps it, and
 * `aria-activedescendant` says which option is current. Arrow keys walk, Enter and Tab
 * accept, Escape closes without accepting — a designer who did not want a suggestion must
 * be able to say so without losing what they typed.
 *
 * **Completion is on the token at the end of the field**, which is a real limitation and is
 * stated rather than hidden: editing the middle of an existing expression offers nothing.
 * The alternative needs the caret position, which means a primitive that exposes its
 * `selectionStart` — a much larger thing to ask of a host's design system than six
 * attributes, and one §L4 can revisit if anybody wants it.
 */
export function ExpressionField({
  surface,
  owner,
  id,
  hint,
  value,
  onValueChange,
  'data-testid': testId,
}: ExpressionFieldProps): ReactElement {
  const { Input } = useCreatorComponents();
  const listId = `${id}-suggestions`;
  const completion = useCompletion(surface, owner, listId, value, onValueChange);

  return (
    <>
      <Input
        className="kajay-properties__input"
        id={id}
        data-testid={testId}
        aria-describedby={hint}
        role="combobox"
        aria-expanded={completion.matches.length > 0}
        aria-controls={listId}
        aria-activedescendant={completion.activeId}
        aria-autocomplete="list"
        // The browser's own history menu over a suggestion list is two popups on one field.
        autoComplete="off"
        value={value}
        onValueChange={completion.type}
        onKeyDown={completion.keys}
      />
      <SuggestionList
        listId={listId}
        matches={completion.matches}
        current={completion.current}
        onAccept={completion.accept}
      />
    </>
  );
}

interface Completion {
  readonly matches: readonly ExpressionSuggestion[];
  readonly current: ExpressionSuggestion | undefined;
  readonly activeId: string | undefined;
  readonly type: (next: string) => void;
  readonly keys: (event: KeyboardEvent<HTMLInputElement>) => void;
  readonly accept: (suggestion: ExpressionSuggestion) => void;
}

/**
 * What is being offered, and what the keyboard does about it.
 *
 * Separate from the markup so the component above is the ARIA wiring and nothing else —
 * which is the part a reader has to check against the combobox pattern.
 */
function useCompletion(
  surface: DesignSurface,
  owner: string,
  listId: string,
  value: string,
  onValueChange: (value: string) => void,
): Completion {
  const [active, setActive] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const token = tokenAt(value, value.length);
  const matches = isOpen
    ? matchingSuggestions(expressionSuggestions(surface.survey, owner), token)
    : [];
  const current = matches[Math.min(active, matches.length - 1)];
  const accept = (suggestion: ExpressionSuggestion): void => {
    onValueChange(applySuggestion(value, token, suggestion).text);
    setIsOpen(false);
    setActive(0);
  };

  return {
    matches,
    current,
    activeId: current === undefined ? undefined : optionId(listId, matches, current),
    accept,
    type: (next) => {
      setIsOpen(true);
      setActive(0);
      onValueChange(next);
    },
    keys: (event) => {
      handleKey(event, matches, active, {
        setActive,
        close: () => {
          setIsOpen(false);
        },
        accept,
      });
    },
  };
}

/**
 * The options themselves.
 *
 * `mousedown` rather than `click`, because the field is about to lose focus and a blur that
 * closed the list first would take the option out from under the pointer choosing it.
 */
function SuggestionList({
  listId,
  matches,
  current,
  onAccept,
}: {
  readonly listId: string;
  readonly matches: readonly ExpressionSuggestion[];
  readonly current: ExpressionSuggestion | undefined;
  readonly onAccept: (suggestion: ExpressionSuggestion) => void;
}): ReactElement {
  return (
    <ul className="kajay-suggestions" id={listId} role="listbox" aria-label="Expression suggestions">
      {matches.map((suggestion) => (
        <li
          key={suggestion.insert}
          className="kajay-suggestions__option"
          id={optionId(listId, matches, suggestion)}
          role="option"
          aria-selected={suggestion === current}
          data-kind={suggestion.kind}
          onMouseDown={(event) => {
            event.preventDefault();
            onAccept(suggestion);
          }}
        >
          {suggestion.label}
        </li>
      ))}
    </ul>
  );
}

function optionId(
  listId: string,
  matches: readonly ExpressionSuggestion[],
  suggestion: ExpressionSuggestion,
): string {
  return `${listId}-${String(matches.indexOf(suggestion))}`;
}

interface KeyActions {
  readonly setActive: (index: number) => void;
  readonly close: () => void;
  readonly accept: (suggestion: ExpressionSuggestion) => void;
}

/**
 * The keyboard grammar, which is the whole of what makes this operable without a pointer.
 *
 * Every key it claims is one the list is genuinely using: the arrows would otherwise move
 * the caret while somebody is choosing, and Enter would submit whatever form the Creator
 * has been dropped into. Everything else — including Enter when nothing is offered — is
 * left alone, because a field that swallowed keys it was not using would be worse than one
 * with no suggestions at all.
 */
function handleKey(
  event: KeyboardEvent<HTMLInputElement>,
  matches: readonly ExpressionSuggestion[],
  active: number,
  actions: KeyActions,
): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    actions.close();
    return;
  }
  if (matches.length === 0) {
    return;
  }
  const at = Math.min(active, matches.length - 1);
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    // Wraps, because a list of three is quicker to reach the end of by going up.
    actions.setActive((at + step + matches.length) % matches.length);
    return;
  }
  const chosen = matches[at];
  if ((event.key === 'Enter' || event.key === 'Tab') && chosen !== undefined) {
    event.preventDefault();
    actions.accept(chosen);
  }
}
