import { isEmptyValue } from '../expressions/expressionValues.js';
import { AsyncValidator } from './AsyncValidator.js';
import type { Question } from './Question.js';
import type { ServerValidationError, ServerValidator } from './ServerValidator.js';
import type { SurveyError } from './SurveyError.js';
import type { ExpressionEvaluator } from './validateAnswer.js';

/** Errors gathered out of process, keyed by the question they belong to. */
export type AsyncErrorsByQuestion = ReadonlyMap<string, readonly SurveyError[]>;

export interface AsyncValidationRequest {
  readonly questions: readonly Question[];
  readonly evaluate: ExpressionEvaluator;
  readonly data: Readonly<Record<string, unknown>>;
  readonly serverValidator: ServerValidator | undefined;
}

export interface AsyncValidationResult {
  readonly errors: AsyncErrorsByQuestion;
  /** Set when the server check itself failed. Never an objection to an answer. */
  readonly serverError: string | undefined;
}

/** True when anything in this set would need a round trip. */
export function hasAsyncWork(
  questions: readonly Question[],
  serverValidator: ServerValidator | undefined,
): boolean {
  if (serverValidator !== undefined) {
    return true;
  }
  return questions.some((question) => asyncValidatorsFor(question).length > 0);
}

/**
 * Runs every out-of-process check for a set of questions, concurrently.
 *
 * Concurrently and not sequentially: these are independent lookups, and making a
 * respondent wait for the sum of them rather than the longest is a cost with nothing
 * bought by it. `Promise.all` and not `allSettled` inside a question, because each
 * validator already resolves rather than rejecting for an ordinary failed check — a
 * rejection here is the host's bug, and the caller turns it into `serverError`.
 */
export async function collectAsyncErrors(
  request: AsyncValidationRequest,
): Promise<AsyncValidationResult> {
  const [byQuestion, server] = await Promise.all([
    runValidators(request),
    runServerValidator(request),
  ]);

  const merged = new Map(byQuestion);
  for (const { questionName, text } of server.errors) {
    merged.set(questionName, [...(merged.get(questionName) ?? []), { kind: 'server', text }]);
  }
  return { errors: merged, serverError: server.failure };
}

function asyncValidatorsFor(question: Question): readonly AsyncValidator[] {
  // Empty answers are `isRequired`'s business, exactly as in the synchronous pass —
  // and a lookup against an empty value would be a request with nothing to ask.
  if (isEmptyValue(question.value)) {
    return [];
  }
  return question.validators.filter((validator) => validator instanceof AsyncValidator);
}

async function runValidators(request: AsyncValidationRequest): Promise<AsyncErrorsByQuestion> {
  const entries = await Promise.all(
    request.questions.map(async (question) => {
      const context = { value: question.value, evaluate: request.evaluate };
      const results = await Promise.all(
        asyncValidatorsFor(question).map((validator) => validator.validateAsync(context)),
      );
      const errors = results.filter((error) => error !== undefined);
      return [question.name, errors] as const;
    }),
  );
  return new Map(entries.filter(([, errors]) => errors.length > 0));
}

interface ServerOutcome {
  readonly errors: readonly ServerValidationError[];
  readonly failure: string | undefined;
}

async function runServerValidator(request: AsyncValidationRequest): Promise<ServerOutcome> {
  const { serverValidator } = request;
  if (serverValidator === undefined) {
    return { errors: [], failure: undefined };
  }
  try {
    const errors = await serverValidator({
      data: request.data,
      questionNames: request.questions.map((question) => question.name),
    });
    return { errors, failure: undefined };
  } catch (cause) {
    return {
      errors: [],
      failure: cause instanceof Error ? cause.message : String(cause),
    };
  }
}
