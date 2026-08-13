import { isEmptyValue } from '../expressions/expressionValues.js';
import type { AnswerScore } from './answerScore.js';
import { CellValueHost } from './matrixCells.js';
import { asAnswerRecord, withAnswerEntry } from './objectAnswers.js';
import { parseBlankTemplate } from './parseBlankTemplate.js';
import type { TemplateSegment } from './parseBlankTemplate.js';
import { Question } from './Question.js';
import type { SurveyElement } from './SurveyElement.js';
import type { SurveyError } from './SurveyError.js';
import type { ValidationContext } from './Validator.js';

const DEFAULT_REQUIRED_TEXT = 'This question requires an answer.';

/**
 * A sentence with fields in it — checklist C13,
 * [ADR-0048](../../../../docs/adr/0048-fill-in-the-blank-question.md).
 *
 * The prose is a *layout*. What sits in it is any question that fits in a line — a text
 * field, a dropdown, a multi-select, a yes/no — so authoring a form here is writing a
 * sentence. Filling in a blank is the simplest case of that rather than the whole of it.
 *
 * **The blanks are real questions**, as a matrix's cell columns and a dynamic panel's
 * template elements already are. A dropdown blank *is* a `dropdown`, which is what makes
 * its choices, its remote choices, its carry-forward and its marking arrive with it
 * instead of being rebuilt inside a private item type.
 *
 * The answer stays one object keyed by blank name, so an expression elsewhere reaches a
 * single blank as `{geography.capital}` — and a multi-select blank simply stores an array
 * under its key, which that shape already allowed.
 */
export class FillInTheBlankQuestion extends Question {
  readonly #blanks: Question[] = [];

  override get type(): string {
    return 'fillintheblank';
  }

  /**
   * The prose, with `[[name]]` marking where each blank goes.
   *
   * One localizable string, deliberately not a list of segments: word order moves between
   * languages, so a translator has to move the marker *within* the sentence. In a string
   * they can; in a structure they would have to edit JSON.
   */
  get template(): string {
    return this.getStringProperty('template');
  }

  set template(value: string) {
    this.setPropertyValue('template', value);
  }

  /** What each `[[name]]` in the template means. Declared here, positioned there. */
  get blanks(): readonly Question[] {
    return this.#blanks;
  }

  /**
   * The prose split into what is drawn: text, then a field, then more text.
   *
   * Computed on read rather than cached, because the template is localizable — switching
   * locale replaces the sentence, and a cached split would draw the previous language's
   * gaps in the new language's words.
   */
  get segments(): readonly TemplateSegment[] {
    return parseBlankTemplate(this.template);
  }

  /** The blank a `[[name]]` refers to, or nothing when the template names one nobody declared. */
  getBlank(name: string): Question | undefined {
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
   * Whether this sentence is graded at all — asked of the blanks.
   *
   * This type inherits `correctAnswer` from `Question` and never uses it, so reading the
   * inherited property would leave a fully marked sentence out of the quiz because nobody
   * wrote an answer at a level that means nothing here.
   */
  override get isQuizQuestion(): boolean {
    return this.#blanks.some((blank) => blank.isQuizQuestion);
  }

  /**
   * A mark per marked blank, each scored by its own type.
   *
   * **Partial credit needs no arithmetic of its own.** A multi-select blank is scored by
   * the same choice-by-choice rule a checkbox uses, because it *is* one — so a sentence
   * holding one is worth that blank's marks rather than a single mark for the clause.
   */
  override scoreAnswer(): AnswerScore {
    return this.#blanks
      .filter((blank) => blank.isQuizQuestion)
      .map((blank) => blank.scoreAnswer())
      .reduce(
        (running, score) => ({
          correct: running.correct + score.correct,
          total: running.total + score.total,
        }),
        { correct: 0, total: 0 },
      );
  }

  /**
   * An untouched sentence still has required blanks to object about, so the whole of it is
   * checked rather than only the blanks somebody has already reached.
   */
  override get checksEmptyAnswer(): boolean {
    return this.#blanks.some((blank) => blank.isRequired);
  }

  /**
   * Each blank's own rules, reported against the blank that earned them.
   *
   * `path` rather than a prefixed message, so a renderer can put the message beside the
   * field it belongs to — which matters more here than anywhere else, since the fields sit
   * inside a sentence and a list below could not say which word it meant.
   */
  override checkValue(context: ValidationContext): readonly SurveyError[] {
    const record = asAnswerRecord(context.value);
    return this.#blanks.flatMap((blank) => {
      const value = record[blank.name];
      // Requiredness is the survey's rule for a question on a page, and a blank is on no
      // page — so it is asked here, where the sentence knows which of its fields is empty.
      if (isEmptyValue(value)) {
        return blank.isRequired
          ? [
              {
                kind: 'required' as const,
                text: blank.requiredErrorText.length > 0
                  ? blank.requiredErrorText
                  : DEFAULT_REQUIRED_TEXT,
                path: blank.name,
              },
            ]
          : [];
      }
      return blank
        .checkValue({ value, evaluate: context.evaluate })
        .map((error) => Object.assign({}, error, { path: blank.name }));
    });
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
    if (!(child instanceof Question)) {
      throw new Error(`blanks accepts questions; received "${child.type}".`);
    }
    // A blank reads and writes *inside this question's answer*, not beside it. Without
    // this it would be a real question pointed at the survey, quietly owning a top-level
    // answer of its own name — the same host a matrix cell is given, for the same reason.
    child.attachValueHost(
      new CellValueHost(
        this,
        (name) => this.getBlankValue(name),
        (name, value) => {
          this.setBlankValue(name, value);
        },
      ),
    );
    this.#blanks.push(child);
  }
}
