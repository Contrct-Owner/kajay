/// <reference types="@vitest/browser/matchers" />
import type { SurveyDefinition } from '@kajay/core';
import { afterEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { DefinitionAuthoringPanel } from '../../src/features/definition-authoring/index.js';

const definition: SurveyDefinition = {
  title: 'Managed onboarding',
  pages: [{ name: 'profile', elements: [{ type: 'text', name: 'fullName' }] }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

test('a creator save becomes a draft, revision, and release through the feature interface', async () => {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (init?.method === undefined) {
      return Promise.resolve(new Response(undefined, { status: 404 }));
    }
    if (path.endsWith('/draft')) {
      return Promise.resolve(json(draftResponse(readSavedDefinition(init))));
    }
    if (path.endsWith('/revisions')) return Promise.resolve(json(revisionResponse()));
    return Promise.resolve(json(releaseResponse()));
  }));
  const screen = await render(<DefinitionAuthoringPanel initialDefinition={definition} />);

  await expect.element(screen.getByTestId('creator-save-state')).toHaveAttribute(
    'data-state',
    'saved',
  );
  await expect.element(screen.getByText('Draft 1')).toBeVisible();
  await screen.getByRole('button', { name: 'Create revision' }).click();
  await expect.element(screen.getByText('Revision 1')).toBeVisible();
  await screen.getByRole('button', { name: 'Create release' }).click();
  await expect.element(screen.getByText(/Release sha256:release-dig/u)).toBeVisible();
});

test('an unauthenticated author gets an actionable WorkOS login', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(
    { detail: 'Authentication is required.' },
    401,
  ))));
  const screen = await render(<DefinitionAuthoringPanel initialDefinition={definition} />);

  await expect.element(screen.getByRole('alert')).toHaveTextContent('Authenticate with WorkOS');
  await expect.element(screen.getByRole('link', { name: 'Sign in as the local admin' }))
    .toHaveAttribute('href', '/auth/login?loginHint=admin%40kajay.local');
});

function draftResponse(savedDefinition: SurveyDefinition): object {
  return {
    managedDefinitionName: 'onboarding',
    definition: savedDefinition,
    definitionDigest: 'sha256:definition-digest',
    version: 1,
    updatedBy: 'author',
    updatedAt: '2026-08-06T00:00:00Z',
    created: true,
  };
}

function readSavedDefinition(init: RequestInit): SurveyDefinition {
  const body = JSON.parse(String(init.body)) as { readonly definition: SurveyDefinition };
  return body.definition;
}

function revisionResponse(): object {
  return {
    managedDefinitionName: 'onboarding',
    number: 1,
    sourceDraftVersion: 1,
    definitionDigest: 'sha256:definition-digest',
    createdBy: 'author',
    createdAt: '2026-08-06T00:00:00Z',
    created: true,
  };
}

function releaseResponse(): object {
  return {
    digest: 'sha256:release-digest',
    managedDefinitionName: 'onboarding',
    versionLabel: '1.0.0',
    installed: true,
  };
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
