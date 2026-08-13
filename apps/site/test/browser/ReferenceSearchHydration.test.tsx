/// <reference types="@vitest/browser/matchers" />
// **The race a server-rendered search box has to survive.** The documentation site is
// server-rendered, so the combobox is on screen, focusable and typeable from the first
// paint — before React has run at all. A visitor on a slow connection who reaches for it
// immediately types into markup with no listeners attached: the browser updates the DOM
// value, the `input` event finds nobody, and React's state never hears about the query.
//
// Nothing recovers on its own. The component learns of a query from `change` or `focus`
// and neither happens again for someone who has already typed and is now waiting for a
// result list that will never open. The search box accepts text and does nothing.
//
// Proven here rather than in the end-to-end suite because the race has to be *caused*, not
// waited for: this file server-renders the markup and hydrates it as two separate steps, so
// the keystroke lands inside the window the deployed site only sometimes leaves open. The
// same scenario in Playwright is a coin toss on how quickly the bundle arrives — which is
// exactly how this defect reached us, as an intermittent failure of the search journey in
// `apps/site/e2e/docs.spec.ts` that read as flake.
//
// `act` rather than polling for the same reason. It is the seam React gives a test for "the
// work you scheduled is finished", and without it the assertions race hydration a second
// time — including the teardown, which unmounts a root React is still hydrating.
import { act } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { ReferenceSearch } from '../../src/features/reference-docs/index.js';

let hydrated: Root | undefined;
let host: HTMLElement | undefined;

// React's own switch for `act`, set through `Reflect` because it is not on the global type
// and this file has no business adding it to every browser test in the project.
function actEnvironment(enabled: boolean): void {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', enabled);
}

beforeEach(() => {
  actEnvironment(true);
});

afterEach(async () => {
  await act(() => {
    hydrated?.unmount();
  });
  host?.remove();
  hydrated = undefined;
  host = undefined;
  actEnvironment(false);
});

/** The search box exactly as the server sends it: real markup, with no React behind it. */
function serverRendered(): { readonly container: HTMLElement; readonly input: HTMLInputElement } {
  const container = document.createElement('div');
  document.body.append(container);
  container.innerHTML = renderToString(<ReferenceSearch />);
  host = container;
  const input = container.querySelector('input[role="combobox"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('The server-rendered documentation search has no combobox to type into.');
  }
  return { container, input };
}

/** A keystroke on markup React has not hydrated: the value lands, the event finds nobody. */
function typeBeforeHydration(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function hydrate(container: HTMLElement): Promise<void> {
  await act(() => {
    hydrated = hydrateRoot(container, <ReferenceSearch />);
  });
}

function optionUrls(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[role="listbox"] [role="option"]')].map(
    (option) => option.getAttribute('href') ?? '',
  );
}

test('documentation search opens for a query typed before hydration', async () => {
  const { container, input } = serverRendered();
  typeBeforeHydration(input, 'parseSurvey');

  await hydrate(container);

  // The list opens by itself. Before this behaviour existed the component stayed closed for
  // the rest of the page's life, because only a later change or focus could have opened it.
  expect(container.querySelector('[role="listbox"]')).not.toBeNull();
  expect(input.getAttribute('aria-expanded')).toBe('true');

  // Opening is not enough: the results have to be the ones the visitor asked for. An empty
  // query matches nothing at all, so a list carrying this page is the claim that React's
  // state — not merely the DOM node it was typed into — now holds the query.
  expect(optionUrls(container)).toContain('/docs/reference/api/core/parse-survey');

  // And what they typed survives. Recovery that opened the list by clearing the box would
  // trade one broken search for another.
  expect(input.value).toBe('parseSurvey');
});

test('documentation search stays closed when nothing was typed before hydration', async () => {
  const { container, input } = serverRendered();

  await hydrate(container);

  // Every visitor who did not type hydrates through the same path, so the recovery has to
  // tell "a query is waiting" from "the box is empty". A panel of results nobody asked for,
  // over the page they were reading, is the failure this rules out.
  expect(container.querySelector('[role="listbox"]')).toBeNull();
  expect(input.getAttribute('aria-expanded')).toBe('false');
  expect(input.value).toBe('');
});
