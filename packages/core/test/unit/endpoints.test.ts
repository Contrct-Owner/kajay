import { parseSurvey } from '@kajay/core';
import type { ParseResult } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

/** Records what the host was asked to fetch, and answers with two choices. */
function recordingFetcher(asked: string[]): (url: string) => Promise<unknown> {
  return (url) => {
    asked.push(url);
    return Promise.resolve([{ id: 1, name: 'Ada' }]);
  };
}

function build(
  url: string,
  options: Readonly<Record<string, unknown>> = {},
): ParseResult {
  return parseSurvey(
    {
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'team' },
            {
              type: 'dropdown',
              name: 'owner',
              choicesByUrl: url,
              choicesValueName: 'id',
              choicesTitleName: 'name',
            },
          ],
        },
      ],
    },
    createTestRegistry(),
    options,
  );
}

function flush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('parity/B11-deployment-scope', () => {
  test('an endpoint the host supplies becomes the origin', async () => {
    const asked: string[] = [];
    build('{@usersApi}/users', {
      fetchJson: recordingFetcher(asked),
      endpoints: { usersApi: 'https://uat.acme.com' },
    });
    await flush();

    expect(asked).toEqual(['https://uat.acme.com/users']);
  });

  test('it is substituted verbatim, because it is a prefix and not a value', async () => {
    const asked: string[] = [];
    build('{@usersApi}/users', {
      fetchJson: recordingFetcher(asked),
      endpoints: { usersApi: 'https://uat.acme.com' },
    });
    await flush();

    // Percent-encoding an origin produces `https%3A%2F%2Fuat.acme.com/users`, which is
    // the exact failure that ruled out carrying the base URL as an answer.
    expect(asked[0]).not.toContain('%3A');
  });

  test('an answer in the same URL is still encoded, because it is a value', async () => {
    const asked: string[] = [];
    const { survey } = build('{@usersApi}/teams/{team}/users', {
      fetchJson: recordingFetcher(asked),
      endpoints: { usersApi: 'https://uat.acme.com' },
    });
    survey.setValue('team', 'a/b?c');
    await flush();

    // The two scopes get opposite treatment on purpose: an unencoded answer is a way
    // for a respondent to reach a path — or a host — nobody intended.
    expect(asked.at(-1)).toBe('https://uat.acme.com/teams/a%2Fb%3Fc/users');
  });

  test('an endpoint is never a graph dependency', async () => {
    const asked: string[] = [];
    const { survey } = build('{@usersApi}/users', {
      fetchJson: recordingFetcher(asked),
      endpoints: { usersApi: 'https://uat.acme.com' },
    });
    await flush();
    const before = asked.length;

    survey.setValue('team', 'anything');
    await flush();

    // Constant for the session, so nothing re-fetches. Registering a dependency on it
    // would add a graph node waiting for an answer nobody will ever supply.
    expect(asked).toHaveLength(before);
  });

  test('an undeclared endpoint is an error, not an empty string', () => {
    const { diagnostics } = build('{@usersApi}/users', { fetchJson: recordingFetcher([]) });

    expect(diagnostics).toEqual([
      {
        severity: 'error',
        code: 'undeclared-endpoint',
        message:
          '"owner" loads choices from "@usersApi", which no endpoint supplies. Pass it as the endpoints option.',
        path: '/owner',
      },
    ]);
  });

  test('and the request it would have sent is not sent to the app instead', async () => {
    const asked: string[] = [];
    build('{@usersApi}/users', { fetchJson: recordingFetcher(asked) });
    await flush();

    // `/users` against the app's own origin either 404s confusingly or, worse, succeeds
    // against something never meant to answer it.
    expect(asked).toEqual([]);
  });

  test('a relative URL still needs no endpoint at all', async () => {
    const asked: string[] = [];
    const { diagnostics } = build('/users', { fetchJson: recordingFetcher(asked) });
    await flush();

    // The one-origin case ADR-0017 kept: the host resolves it in `fetchJson`.
    expect(diagnostics).toEqual([]);
    expect(asked).toEqual(['/users']);
  });

  test('the template round-trips; the resolved origin never does', () => {
    const { survey } = build('{@usersApi}/users', {
      fetchJson: recordingFetcher([]),
      endpoints: { usersApi: 'https://uat.acme.com' },
    });
    const owner = survey.getQuestionByName('owner');

    // What was authored, not what it resolved to — or promoting the definition to
    // another environment would carry this one's origin with it (ADR-0002).
    expect(owner?.getPropertyValue('choicesByUrl')).toBe('{@usersApi}/users');
  });
});
