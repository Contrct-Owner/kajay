import { isEmptyValue } from '../expressions/expressionValues.js';
import { FillInTheBlankItem } from './FillInTheBlankItem.js';
import type { AnswerScore } from './answerScore.js';
import { matchesAuthoredText } from './answerScore.js';
import { asAnswerRecord, withAnswerEntry } from './objectAnswers.js';
import { parseBlankTemplate } from './parseBlankTemplate.js';
import type { TemplateSegment } from './parseBlankTemplate.js';
import { Question } from './Question.js';
import type { SurveyElement } from './SurveyElement.js';
import type { SurveyError } from './SurveyError.js';
import type { ValidationContext } from './Validator.js';

const DEFAULT_REQUIRED_TEXT = 'This question requires an answer.';

/**
 * A sentence with gaps the respondent types into — checklist C13,
 * [ADR-0048](../../../../docs/adr/0048-fill-in-the-blank-question.md).
 *
 * The prose is what makes this a type rather than a composition: `multipletext` already
 * stores several named fields as one object under one name, and an `html` element already
 * renders arbitrary text. Neither can put an input *inside* a sentence, and being inside
 * the sentence is the whole question — the surrounding words are what is being asked.
 *
 * The answer is one object keyed by blank name, exactly as a multiple-text answer is, so
 * an expression elsewhere reaches a single blank as `{geography.capital}` through the path
 * resolver that already walks dotted references.
 */
export class FillInTheBlankQuestion extends Question {
  readonly #blanks: FillInTheBlankItem[] = [];

  override get type(): string {
    return 'fillintheblank';
  }

  /**
   * The prose, with `[[name]]` marking each blank.
   *
   * **One localizable string, and deliberately not a list of segments.** Word order moves
   * between languages — the blank falls elsewhere in German, elsewhere again in Japanese —
   * so a translator has to move the marker *within* the sentence. In a string they can; in
   * a structure they would have to edit JSON, which is not something translation tooling
   * or translators do.
   */
  get template(): string {
    return this.getStringProperty('template');
  }

  set template(value: string) {
    this.setPropertyValue('template', value);
  }

  /** What each `[[name]]` in the template means. Declared here, positioned there. */
  get blanks(): readonly FillInTheBlankItem[] {
    return this.#blanks;
  }

  /**
   * The prose split into what is drawn: text, then a gap, then more text.
   *
   * Computed on read rather than cached, because the template is localizable — switching
   * locale replaces the sentence, and a cached split would draw the previous language's
   * gaps in the new language's words.
   */
  get segments(): readonly TemplateSegment[] {
    return parseBlankTemplate(this.template);
  }

  /** The blank a `[[name]]` refers to, or nothing when the template names one nobody declared. */
  getBlank(name: string): FillInTheBlankItem | undefined {
    return this.#blanks.find((blank) => blank.name === name);
  }

  getBlankValue(name: string): unknown {
    return asAnswerRecord(this.value)[name];
  }

  /** Records one blank's answer. Empty blanks are dropped rather than stored as `""`. */
  setBlankValue(name: string, value: unknown): void {
    this.value = withAnswerEntry(this.value, name, value);
  }

  /**
   * An untouched question still has required blanks to object about — `MultipleTextQuestion`'s
   * rule, for the same reason: without this a required blank never complains until some
   * other blank in the same sentence is filled in.
   */
  override get checksEmptyAnswer(): boolean {
    return this.#blanks.some((blank) => blank.isRequired);
  }

  /**
   * Each blank's own rules, reported against the blank that earned them.
   *
   * `path` rather than a prefixed message, so a renderer can put the message beside the
   * gap it belongs to — which matters more here than anywhere else, since the gaps sit
   * inside a sentence and a list of messages below could not say which word it meant.
   */
  override checkValue(context: ValidationContext): readonly SurveyError[] {
    const record = asAnswerRecord(context.value);
    return this.#blanks.flatMap((blank) => checkBlank(blank, record[blank.name], context));
  }

  /**
   * Whether this sentence is graded at all — checklist E8's rule, asked of the blanks.
   *
   * A fill-in-the-blank inherits `correctAnswer` from `Question` and never uses it: the
   * answers are per blank, so membership is too. Reading the inherited property would
   * leave a fully marked sentence out of the quiz because nobody wrote an answer at a
   * level that means nothing here.
   */
  override get isQuizQuestion(): boolean {
    return this.#blanks.some((blank) => blank.hasPropertyValue('correctAnswer'));
  }

  /**
   * A mark per marked blank — checklist C13.
   *
   * Partial credit falls straight out of `AnswerScore` being a pair: a sentence with four
   * gaps is four decisions wearing one question, exactly as a multi-select is, so nothing
   * new was needed to score it. **Only blanks with a `correctAnswer` count toward the
   * total**, so an author can mark two gaps in a sentence and leave a third for prose the
   * respondent is simply asked to supply.
   */
  override scoreAnswer(): AnswerScore {
    const record = asAnswerRecord(this.value);
    const marked = this.#blanks.filter((blank) => blank.hasPropertyValue('correctAnswer'));
    const correct = marked.filter((blank) =>
      matchesAuthoredText(record[blank.name], blank.correctAnswer, {
        trim: blank.trim,
        caseSensitive: blank.caseSensitive,
      }),
    ).length;
    return { correct, total: marked.length };
  }

  /** Default blank width in characters. A blank's own `size` wins. */
  get blankSize(): number {
    return this.getNumberProperty('blankSize');
  }

  override getChildren(property: string): readonly SurveyElement[] {
    return property === 'blanks' ? this.#blanks : super.getChildren(property);
  }

  override addChild(property: string, child: SurveyElement): void {
    if (property !== 'blanks') {
      super.addChild(property, child);
      return;
    }
    if (!(child instanceof FillInTheBlankItem)) {
      throw new Error(`blanks accepts fill-in-the-blank items; received "${child.type}".`);
    }
    this.#blanks.push(child);
  }
}

function checkBlank(
  blank: FillInTheBlankItem,
  value: unknown,
  context: ValidationContext,
): readonly SurveyError[] {
  if (isEmptyValue(value)) {
    if (!blank.isRequired) {
      return [];
    }
    const authored = blank.requiredErrorText;
    return [
      {
        kind: 'required',
        text: authored.length > 0 ? authored : DEFAULT_REQUIRED_TEXT,
        path: blank.name,
      },
    ];
  }
  // The blank's own value, not the question's: a validator asked about a date must be
  // shown the date rather than the sentence it sits in.
  const blankContext = { value, evaluate: context.evaluate };
  return blank.validators.flatMap((validator) => {
    const error = validator.validate(blankContext);
    return error === undefined ? [] : [{ ...error, path: blank.name }];
  });
}
