import { isEmptyValue } from '../expressions/expressionValues.js';
import { AsyncValidator } from './AsyncValidator.js';
import type { SurveyError } from './SurveyError.js';
import type { Question } from './Question.js';
import type { ServerValidationError, ServerValidator } from './ServerValidator.js';
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
  /**
   * Set when a check could not be performed at all — the server was unreachable, or a
   * validator threw. Never an objection to an answer: nothing the respondent typed is
   * at fault, and telling them to fix a field would send them looking for a mistake
   * they did not make.
   */
  readonly failure: string | undefined;
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
 * bought by it.
 *
 * **Nothing here is allowed to reject.** An unhandled rejection anywhere in this chain
 * leaves the caller's `isValidating` stuck true, which a respondent sees as a Next
 * button that says "Checking…" and never comes back — a hung survey with no error and
 * no way forward. Every await is therefore wrapped, and a failure comes back as data.
 */
export async function collectAsyncErrors(
  request: AsyncValidationRequest,
): Promise<AsyncValidationResult> {
  const [validators, server] = await Promise.all([
    runValidators(request),
    runServerValidator(request),
  ]);

  const merged = new Map(validators.errors);
  for (const { questionName, text } of server.errors) {
    merged.set(questionName, [...(merged.get(questionName) ?? []), { kind: 'server', text }]);
  }
  return { errors: merged, failure: validators.failure ?? server.failure };
}

function asyncValidatorsFor(question: Question): readonly AsyncValidator[] {
  // Empty answers are `isRequired`'s business, exactly as in the synchronous pass —
  // and a lookup against an empty value would be a request with nothing to ask.
  if (isEmptyValue(question.value)) {
    return [];
  }
  return question.validators.filter((validator) => validator instanceof AsyncValidator);
}

interface ValidatorOutcome {
  readonly errors: AsyncErrorsByQuestion;
  readonly failure: string | undefined;
}

/**
 * Runs one validator, turning any way it can go wrong into a value.
 *
 * A validator that throws — synchronously or by rejecting — is the host's bug, and the
 * respondent's answer is not at fault. Reporting it as a *check failure* keeps those
 * two things apart, and catching it at all is what stops one bad validator from
 * freezing the survey on "Checking…".
 */
async function runOne(
  validator: AsyncValidator,
  context: { value: unknown; evaluate: ExpressionEvaluator },
): Promise<{ error?: SurveyError; failure?: string }> {
  try {
    const error = await validator.validateAsync(context);
    return error === undefined ? {} : { error };
  } catch (cause) {
    return { failure: cause instanceof Error ? cause.message : String(cause) };
  }
}

async function runValidators(request: AsyncValidationRequest): Promise<ValidatorOutcome> {
  const failures: string[] = [];
  const entries = await Promise.all(
    request.questions.map(async (question) => {
      const context = { value: question.value, evaluate: request.evaluate };
      const results = await Promise.all(
        asyncValidatorsFor(question).map((validator) => runOne(validator, context)),
      );
      for (const { failure } of results) {
        if (failure !== undefined) {
          failures.push(failure);
        }
      }
      const errors = results.flatMap(({ error }) => (error === undefined ? [] : [error]));
      return [question.name, errors] as const;
    }),
  );
  return {
    errors: new Map(entries.filter(([, errors]) => errors.length > 0)),
    failure: failures[0],
  };
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
