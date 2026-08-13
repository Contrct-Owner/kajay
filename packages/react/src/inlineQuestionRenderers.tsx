import { MultiSelectQuestion, RatingQuestion, SelectQuestion, TextQuestion } from '@kajay/core';
import type { ExpressionQuestion, Question } from '@kajay/core';
import type { ReactElement } from 'react';
import type { PageElementRendererRegistry } from './PageElementRendererRegistry.js';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
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
 * A single-select, drawn as a native `<select>`.
 *
 * Native because it is one control on one line, it is keyboard-operable and named without
 * any interaction of its own, and a portalled listbox in the middle of a paragraph is a
 * layout problem before it is an accessibility one.
 */
function InlineDropdown({ question }: QuestionRendererProps): ReactElement {
  if (!(question instanceof SelectQuestion)) {
    return <span className="kajay-fillintheblank__gap" />;
  }
  return (
    <select
      className="kajay-question__input kajay-fillintheblank__input"
      aria-label={accessibleName(question)}
      disabled={!question.isEnabled || question.isReadOnly}
      required={question.isRequired}
      aria-required={question.isRequired}
      value={String(question.value ?? '')}
      onChange={(event) => {
        question.value = event.target.value;
      }}
    >
      {/* An empty option, or a respondent cannot take back a first choice — and the field
          would report a value nobody picked the moment it was drawn. */}
      <option value="">{''}</option>
      {question.visibleChoices.map((choice) => (
        <option key={String(choice.value)} value={String(choice.value)}>
          {choice.text}
        </option>
      ))}
    </select>
  );
}

/**
 * A multi-select, drawn as a native multiple `<select>`.
 *
 * The one control that says "several of these" without becoming a list of its own, which
 * is what a tagbox would be if it were opened out inside a sentence.
 */
function InlineMultiSelect({ question }: QuestionRendererProps): ReactElement {
  if (!(question instanceof MultiSelectQuestion)) {
    return <span className="kajay-fillintheblank__gap" />;
  }
  return (
    <select
      multiple
      className="kajay-question__input kajay-fillintheblank__input"
      aria-label={accessibleName(question)}
      disabled={!question.isEnabled || question.isReadOnly}
      required={question.isRequired}
      aria-required={question.isRequired}
      value={question.selectedValues.map(String)}
      onChange={(event) => {
        question.applySelection(
          [...event.target.selectedOptions].map((option) => option.value),
        );
      }}
    >
      {question.visibleChoices.map((choice) => (
        <option key={String(choice.value)} value={String(choice.value)}>
          {choice.text}
        </option>
      ))}
    </select>
  );
}

/** A yes/no, drawn as a checkbox: one control, one word's width. */
function InlineBoolean({ question }: QuestionRendererProps): ReactElement {
  return (
    <input
      type="checkbox"
      className="kajay-fillintheblank__input"
      aria-label={accessibleName(question)}
      disabled={!question.isEnabled || question.isReadOnly}
      checked={question.value === true}
      onChange={(event) => {
        question.value = event.target.checked;
      }}
    />
  );
}

/**
 * A computed value, drawn as text.
 *
 * Read-only by its nature, so a sentence can state a total mid-clause without the
 * respondent being offered a control they cannot use.
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
  return (
    <select
      className="kajay-question__input kajay-fillintheblank__input"
      aria-label={accessibleName(question)}
      disabled={!question.isEnabled || question.isReadOnly}
      required={question.isRequired}
      aria-required={question.isRequired}
      value={String(question.value ?? '')}
      onChange={(event) => {
        question.value = event.target.value;
      }}
    >
      <option value="">{''}</option>
      {question.rateValues.map((rate) => (
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
