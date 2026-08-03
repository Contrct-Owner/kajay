import { DropdownQuestion, TagboxQuestion, parseSurvey } from '@kajay/core';
import type { ChoicePage, ChoicePageRequest, SelectQuestion, Survey } from '@kajay/core';
import { createTestRegistry } from './createTestRegistry.js';

/**
 * A stand-in for the host's own API.
 *
 * Not a mock of anything of ours — it is the far side of the seam, and the whole point
 * of the seam is that core cannot see it. It records what it was asked, so a test can
 * prove the question asked for the *next* page rather than the same one again.
 */
export class FakeChoiceDirectory {
  readonly asked: ChoicePageRequest[] = [];
  /**
   * Every request, in order, still waiting for an answer.
   *
   * A list rather than one slot, so a test can answer them **out of order** — which is
   * the only way to prove what happens when a reply for an abandoned term arrives after
   * the reply for the current one.
   */
  readonly #pending: {
    readonly resolve: (page: ChoicePage) => void;
    readonly reject: (cause: Error) => void;
  }[] = [];
  readonly #names: readonly string[];

  constructor(names: readonly string[]) {
    this.#names = names;
  }

  /** The loader a host would pass as `loadChoicePage`. */
  readonly load = (request: ChoicePageRequest): Promise<ChoicePage> => {
    this.asked.push(request);
    return new Promise<ChoicePage>((resolve, reject) => {
      this.#pending.push({ resolve, reject });
    });
  };

  /** Answers one request the way the fake directory would. Defaults to the latest. */
  reply(index = this.asked.length - 1): void {
    const request = this.asked[index];
    const pending = this.#pending[index];
    if (request === undefined || pending === undefined) {
      throw new Error(`nothing was asked at ${String(index)}`);
    }
    const matching = this.#names.filter((name) =>
      name.toLowerCase().includes(request.filter.toLowerCase()),
    );
    const page = matching.slice(request.skip, request.skip + request.take);
    pending.resolve({
      items: page.map((name) => ({ value: name })),
      hasMore: request.skip + page.length < matching.length,
    });
  }

  fail(message: string, index = this.asked.length - 1): void {
    const pending = this.#pending[index];
    if (pending === undefined) {
      throw new Error(`nothing was asked at ${String(index)}`);
    }
    pending.reject(new Error(message));
  }
}

export const CITIES = ['Aberdeen', 'Bristol', 'Cardiff', 'Dundee', 'Exeter', 'Falmouth', 'Glasgow'];

export interface Paged {
  readonly survey: Survey;
  readonly question: SelectQuestion;
  readonly directory: FakeChoiceDirectory;
}

export function paged(extra: Readonly<Record<string, unknown>> = {}, type = 'dropdown'): Paged {
  const directory = new FakeChoiceDirectory(CITIES);
  const survey = parseSurvey(
    {
      pages: [
        {
          name: 'p1',
          elements: [
            {
              type,
              name: 'city',
              title: 'Where do you work?',
              choicesLazyLoadEnabled: true,
              choicesLazyLoadPageSize: 3,
              ...extra,
            },
          ],
        },
      ],
    },
    createTestRegistry(),
    { loadChoicePage: directory.load },
  ).survey;
  const question = survey.getQuestionByName('city');
  if (!(question instanceof DropdownQuestion) && !(question instanceof TagboxQuestion)) {
    throw new TypeError('expected a collapsed select');
  }
  return { survey, question, directory };
}

/** Lets the pager's promise callbacks run. */
export function flush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** The loaded choices, as a respondent would read them. */
export function choiceTexts(question: SelectQuestion): readonly string[] {
  return question.visibleChoices.map((choice) => choice.text);
}
