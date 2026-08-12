import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * `choicesByUrl` in the playground — the seam, and the site's policy on it.
 *
 * Two claims, and they are separate. The first is that the seam is *wired*: the library
 * never fetches on its own, deliberately, so a host that passes no `fetchJson` renders an
 * empty dropdown and makes no request. The second is that the site decides what may be
 * reached, because the playground is public and its definitions are shareable — a
 * `choicesByUrl` is a URL in a document, and a link carries that document into somebody
 * else's browser, which can reach their intranet and whatever they are signed into.
 *
 * The definitions arrive as share links for exactly that reason: it is the shape of the
 * risk rather than a convenient way to seed a fixture.
 */
const PLAYGROUND = '/playground';

function live(page: Page) {
  return page.getByTestId('live-survey');
}

function sharedDefinition(...questions: readonly Readonly<Record<string, unknown>>[]): string {
  const definition = { schemaVersion: 1, pages: [{ name: 'p1', elements: questions }] };
  const encoded = Buffer.from(JSON.stringify(definition), 'utf8')
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');
  return `${PLAYGROUND}?d=${encoded}`;
}

const PRODUCTS = {
  type: 'dropdown',
  name: 'product',
  title: 'Choose a product',
  choicesValueName: 'id',
  choicesTitleName: 'name',
};

test('parity/B10-rest-choices: an allowed endpoint loads its choices into the live survey', async ({
  page,
}) => {
  // **Answered here rather than over the internet.** The endpoint's uptime is not this
  // repository's behaviour, and a suite that fails when somebody else's demo API is rate
  // limited teaches everyone to ignore it. The interception still proves what the scenario
  // is about: the request only reaches this handler if the allowlist permitted the origin
  // and the host seam was wired, because a refused URL is never requested at all.
  await page.route('https://api.restful-api.dev/objects', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        { id: '1', name: 'Google Pixel 6 Pro' },
        { id: '2', name: 'Apple iPhone 12 Mini' },
      ]),
    }),
  );
  await page.goto(
    sharedDefinition({ ...PRODUCTS, choicesByUrl: 'https://api.restful-api.dev/objects' }),
  );

  await expect(live(page).getByRole('option', { name: 'Google Pixel 6 Pro' })).toBeAttached();
  await expect(page.getByTestId('live-choice-errors')).toHaveCount(0);
});

test('parity/B10-rest-choices: an endpoint outside the allowlist is refused, and says so', async ({
  page,
}) => {
  await page.goto(sharedDefinition({ ...PRODUCTS, choicesByUrl: 'https://example.com/objects' }));

  // Visible, not merely recorded. A blocked URL used to leave an empty dropdown that looked
  // exactly like one still loading, which is why the loader now announces its failures.
  await expect(page.getByTestId('live-choice-errors')).toContainText(
    'The playground only loads choices from',
  );
});

test('parity/B10-rest-choices: an origin that merely starts like an allowed one is refused', async ({
  page,
}) => {
  await page.goto(
    sharedDefinition({
      ...PRODUCTS,
      choicesByUrl: 'https://api.restful-api.dev.evil.example/objects',
    }),
  );

  // The allowlist compares parsed origins. A prefix test would accept this host, which is a
  // different site that merely reads like the permitted one.
  await expect(page.getByTestId('live-choice-errors')).toContainText('is not one of them');
});

test('parity/B10-rest-choices: a load that fails after the survey is on screen still reports', async ({
  page,
}) => {
  // **The scenario the announcement exists for.** The three above pass whether or not a
  // failure notifies anything, because their error is recorded before React first renders
  // — the panel reads an array that is already populated. Here the survey is on screen and
  // answered *first*, so the failure arrives afterwards: without the loader announcing it,
  // nothing tells the panel to look again and the dropdown just sits there empty.
  let requests = 0;
  await page.route('https://api.restful-api.dev/**', (route) => {
    requests += 1;
    return requests === 1
      ? route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify([{ id: '1', name: 'Google Pixel 6 Pro' }]),
        })
      : route.abort('connectionrefused');
  });
  await page.goto(
    sharedDefinition(
      { type: 'text', name: 'region', title: 'Region' },
      { ...PRODUCTS, choicesByUrl: 'https://api.restful-api.dev/objects?q={region}' },
    ),
  );

  await expect(live(page).getByRole('option', { name: 'Google Pixel 6 Pro' })).toBeAttached();
  await expect(page.getByTestId('live-choice-errors')).toHaveCount(0);

  // Answering rewrites the URL, which sends the second request — the one that fails.
  await live(page).getByLabel('Region').fill('eu');

  await expect(page.getByTestId('live-choice-errors')).toContainText('failed');
});
