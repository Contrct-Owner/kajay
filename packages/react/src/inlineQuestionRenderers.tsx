import { BooleanQuestion, RatingQuestion, SelectQuestion, TextQuestion } from '@kajay/core';
import type { ExpressionQuestion, Question } from '@kajay/core';
import type { ReactElement } from 'react';
import { applySelection, ChoiceOptions, currentSelection } from './choiceOptions.js';
import type { PageElementRendererRegistry } from './PageElementRendererRegistry.js';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { InlineMultiSelect } from './InlineMultiSelect.js';
import { readOnlyControl, whenEditable } from './readOnly.js';
import { useSurveyComponents } from './SurveyComponents.js';

/**
 * How a question is drawn when it sits *inside* a sentence — checklist C13, ADR-0048.
 *
 * **Deliberately plainer than the block renderers.** A dropdown on its own has search and
 * lazy paging (§C5, §C6) and a checkbox group is a vertical list; neither belongs in the
 * run of a clause. Inline gets one compact control, which is the honest reading of "fits
 * in a line of prose" — a host that wants the fuller thing registers its own.
 *
 * None of them draws a label. The prose is the label, so each control takes its accessible
 * name from the question's title through `aria-label`: rendering the title would print it
 * inside the sentence that already said it.
 */
function accessibleName(question: Question): string {
  return question.title.length > 0 ? question.title : question.name;
}

/** A text field: the case the feature is named after. */
function InlineText({ question }: QuestionRendererProps): ReactElement {
  const { Input } = useSurveyComponents();
  return (
    <Input
      className="kajay-question__input kajay-fillintheblank__input"
      type={question instanceof TextQuestion ? question.inputType : 'text'}
      // An empty gap says nothing about itself: the prose around it is the label, and a
      // reader who wants a hint inside the box has the same property the block renderer
      // reads. Ignoring it here made `placeholder` mean two different things.
      placeholder={question instanceof TextQuestion ? question.placeholder : ''}
      aria-label={accessibleName(question)}
      readOnly={question.isReadOnly}
      disabled={!question.isEnabled}
      required={question.isRequired}
      aria-required={question.isRequired}
      value={String(question.value ?? '')}
      onValueChange={(next) => {
        question.value = next;
      }}
    />
  );
}

/**
 * A choice gap, drawn as a native `<select>` — the same control the block renderer draws.
 *
 * Native because it is one control on one line, it is keyboard-operable and named without
 * any interaction of its own, and a portalled listbox in the middle of a paragraph is a
 * layout problem before it is an accessibility one.
 *
 * **Its rows, its selection and its read-only behaviour are the block dropdown's**, not a
 * second copy: the first version of this file wrote `question.value = event.target.value`,
 * which turned a choice authored as `1` into `"1"` in the response, and marked a read-only
 * gap `disabled`, which drops it out of the tab order rather than leaving it readable.
 */
function InlineSelect({ question, multiple }: {
  readonly question: SelectQuestion;
  readonly multiple: boolean;
}): ReactElement {
  return (
    <select
      {...(multiple
        ? {
            multiple: true,
            // One row tall, deliberately. A native multiple select otherwise opens out
            // into a list box that pushes the sentence apart — the layout failure this
            // type exists to avoid — so it scrolls in place instead.
            size: 1,
          }
        : {})}
      className="kajay-question__select kajay-fillintheblank__input"
      aria-label={accessibleName(question)}
      disabled={!question.isEnabled}
      required={question.isRequired}
      aria-required={question.isRequired}
      value={currentSelection(question)}
      onChange={(event) => {
        applySelection(question, event.target);
      }}
      {...readOnlyControl(question.isReadOnly)}
    >
      <ChoiceOptions question={question} />
    </select>
  );
}

function InlineDropdown({ question }: QuestionRendererProps): ReactElement {
  return question instanceof SelectQuestion ? (
    <InlineSelect question={question} multiple={false} />
  ) : (
    <span className="kajay-fillintheblank__gap" />
  );
}

/**
 * A yes/no, drawn as the switch the block renderer draws: one control, one word's width.
 *
 * Through the host's `Checkbox` primitive and wearing `kajay-boolean__switch`, so a design
 * system's toggle appears in a sentence exactly as it does on a line of its own. Written
 * as a bare `<input type="checkbox">` it was the only control in the sentence a host's
 * styling never reached — a browser-default 13-pixel square beside four themed fields.
 */
function InlineBoolean({ question }: QuestionRendererProps): ReactElement {
  const { Checkbox } = useSurveyComponents();
  if (!(question instanceof BooleanQuestion)) {
    return <span className="kajay-fillintheblank__gap" />;
  }
  return (
    <Checkbox
      className="kajay-boolean__switch kajay-fillintheblank__input"
      aria-label={accessibleName(question)}
      checked={question.checkedValue === true}
      disabled={!question.isEnabled}
      {...readOnlyControl(question.isReadOnly)}
      onCheckedChange={whenEditable(question.isReadOnly, () => {
        // The model knows which way it is set; a design system's Checkbox has no
        // `event.target` to ask.
        question.setChecked(question.checkedValue !== true);
      })}
    />
  );
}

/**
 * A computed value, drawn as text.
 *
 * Read-only by its nature, so a sentence can state a total mid-clause without offering the
 * respondent a control they cannot use. Its rule is registered with the graph like any
 * other blank's, which is what makes it recompute when the gap it reads changes.
 */
function InlineExpression({ question }: QuestionRendererProps): ReactElement {
  const computed = question as ExpressionQuestion;
  return <span className="kajay-fillintheblank__computed">{computed.displayValue}</span>;
}

/**
 * A rating, drawn as a compact list of its own scale.
 *
 * Not a row of stars: a rating's block renderer spreads across a line of its own, and a
 * scale of ten inside a clause would push the words apart. The values are the question's
 * own, so a scale of 1–5 and a scale of "poor" to "great" both read correctly.
 */
function InlineRating({ question }: QuestionRendererProps): ReactElement {
  if (!(question instanceof RatingQuestion)) {
    return <span className="kajay-fillintheblank__gap" />;
  }
  const rates = question.rateValues;
  return (
    <select
      className="kajay-question__select kajay-fillintheblank__input"
      aria-label={accessibleName(question)}
      disabled={!question.isEnabled}
      required={question.isRequired}
      aria-required={question.isRequired}
      value={String(question.value ?? '')}
      onChange={(event) => {
        // Back through the scale's own entries, so a rating of 4 is the number 4 in the
        // response rather than the string the option carried.
        const chosen = rates.find((rate) => String(rate.value) === event.target.value);
        question.value = chosen?.value;
      }}
      {...readOnlyControl(question.isReadOnly)}
    >
      <option value="">{''}</option>
      {rates.map((rate) => (
        <option key={String(rate.value)} value={String(rate.value)}>
          {rate.text}
        </option>
      ))}
    </select>
  );
}

/** Installs the inline renderers for the types core lets sit in a sentence. */
export function registerInlineQuestionRenderers(registry: PageElementRendererRegistry): void {
  registry.registerInlineQuestion('text', InlineText);
  registry.registerInlineQuestion('dropdown', InlineDropdown);
  registry.registerInlineQuestion('tagbox', InlineMultiSelect);
  registry.registerInlineQuestion('boolean', InlineBoolean);
  registry.registerInlineQuestion('rating', InlineRating);
  registry.registerInlineQuestion('expression', InlineExpression);
}
