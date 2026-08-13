import { MultiSelectQuestion } from '@kajay/core';
import { useEffect, useRef, useState } from 'react';
import type { ReactElement, RefObject } from 'react';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { readOnlyControl, whenEditable } from './readOnly.js';
import { useSurveyComponents } from './SurveyComponents.js';

/**
 * "Several of these" in the run of a sentence — checklist C13.
 *
 * **Not a `<select multiple>`, and this is the one inline control that is not native.**
 * A one-row multiple select is drawn by the browser as a list of its own devising: in
 * Chrome a popup whose checkbox glyphs follow neither `color-scheme` nor any rule a
 * stylesheet can write, in Firefox a one-line scroller. So the one gap whose *contents*
 * were the browser's was the one gap a theme could not reach — white boxes down a dark
 * list, beside a checkbox group that themed perfectly two lines below.
 *
 * What replaces it is those same checkboxes: the host's `Checkbox` primitive, one per
 * choice, behind a disclosure. **A disclosure rather than a listbox**, deliberately — a
 * listbox is a roving-focus ARIA widget and [ADR-0022](../../../docs/adr/0022-design-system-primitives.md)
 * keeps that kind of interaction out of this adapter, while a button that says whether it
 * is open and a group of real checkboxes is the whole of the contract here.
 */

/** Escape, or a pointer anywhere else: the two ways out a respondent will try unprompted. */
function useDismiss(
  isOpen: boolean,
  dismiss: () => void,
  container: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const close = (event: Event): void => {
      const isEscape = event instanceof KeyboardEvent && event.key === 'Escape';
      const isOutside =
        event.type === 'pointerdown' && !container.current?.contains(event.target as Node);
      if (isEscape || isOutside) {
        dismiss();
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    // eslint-disable-next-line consistent-return -- a cleanup only when there is one.
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [isOpen, dismiss, container]);
}

/**
 * Puts the menu in the top layer, under the control it belongs to.
 *
 * **A popover rather than an absolutely positioned box**, because a survey lives inside
 * somebody else's layout: the playground's own card clips its overflow, and the first
 * version of this menu was cut off two choices down inside it. The top layer is outside
 * every ancestor's clipping, which is exactly the problem the browser's own list did not
 * have and this one inherited by being ours.
 *
 * Placed on open and again while the page moves, because a popover has no anchor of its
 * own where anchor positioning is not supported — one `getBoundingClientRect` in each
 * case, which is what the browser would have done.
 */
function usePlacement(
  isOpen: boolean,
  menu: RefObject<HTMLElement | null>,
  anchor: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const element = menu.current;
    if (element === null) {
      return;
    }
    if (!isOpen) {
      if (element.matches(':popover-open')) {
        element.hidePopover();
      }
      return;
    }
    const place = (): void => {
      const box = anchor.current?.getBoundingClientRect();
      if (box !== undefined) {
        element.style.insetBlockStart = `${String(box.bottom + 2)}px`;
        element.style.insetInlineStart = `${String(box.left)}px`;
      }
    };
    element.showPopover();
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    // eslint-disable-next-line consistent-return -- a cleanup only when there is one.
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [isOpen, menu, anchor]);
}

/** The choices themselves: one real checkbox each, so a design system's reaches a sentence. */
function ChoiceMenu({ question, menu }: {
  readonly question: MultiSelectQuestion;
  readonly menu: RefObject<HTMLSpanElement | null>;
}): ReactElement {
  const { Checkbox } = useSurveyComponents();
  return (
    <span
      className="kajay-fillintheblank__menu"
      role="group"
      aria-label={question.title}
      ref={menu}
      popover="manual"
    >
      {question.visibleChoices.map((choice) => (
        <label key={String(choice.value)} className="kajay-choice">
          <Checkbox
            checked={question.isSelected(choice.value)}
            disabled={!question.isEnabled}
            {...readOnlyControl(question.isReadOnly)}
            onCheckedChange={whenEditable(question.isReadOnly, () => {
              // Against the model's own values, so a choice authored as `1` stays the
              // number 1 in the response rather than becoming the string an option carries.
              const next = question.isSelected(choice.value)
                ? question.selectedValues.filter((value) => value !== choice.value)
                : [...question.selectedValues, choice.value];
              question.applySelection(next);
            })}
          />
          <span>{choice.text}</span>
        </label>
      ))}
    </span>
  );
}

export function InlineMultiSelect({ question }: QuestionRendererProps): ReactElement {
  const [isOpen, setOpen] = useState(false);
  const gap = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLSpanElement>(null);
  useDismiss(isOpen, () => {
    setOpen(false);
  }, gap);
  usePlacement(isOpen, menu, button);

  if (!(question instanceof MultiSelectQuestion)) {
    return <span className="kajay-fillintheblank__gap" />;
  }

  const chosen = question.visibleChoices.filter((choice) => question.isSelected(choice.value));
  return (
    <span className="kajay-fillintheblank__multi" ref={gap}>
      <button
        type="button"
        ref={button}
        className="kajay-question__select kajay-fillintheblank__input"
        aria-label={question.title.length > 0 ? question.title : question.name}
        aria-expanded={isOpen}
        disabled={!question.isEnabled}
        {...readOnlyControl(question.isReadOnly)}
        onClick={whenEditable(question.isReadOnly, () => {
          setOpen(!isOpen);
        })}
      >
        {/* What was chosen, in the author's own words, because that is what the sentence
            now says. A count would make a reader open it to find out what they answered. */}
        {chosen.length > 0 ? chosen.map((choice) => choice.text).join(', ') : question.placeholder}
      </button>
      {isOpen ? <ChoiceMenu question={question} menu={menu} /> : null}
    </span>
  );
}
