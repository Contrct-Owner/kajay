/// <reference types="@vitest/browser/matchers" />
import type { SurveyDefinition } from '@kajay/core';
import { afterEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { DefinitionAuthoringPanel } from '../../src/features/definition-authoring/index.js';

const definition: SurveyDefinition = {
  title: 'Managed onboarding',
  pages: [{ name: 'profile', elements: [{ type: 'text', name: 'fullName' }] }],
};

afterEach(() => { vi.unstubAllGlobals(); });

test('reviews semantic release changes against the active environment artifact', async () => {
  const requests: string[] = [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const path = String(input);
    if (path.endsWith('/draft')) return Promise.resolve(json(draftResponse()));
    if (path.includes('/comparison?')) {
      requests.push(path);
      return Promise.resolve(json(comparisonResponse()));
    }
    if (path.includes('/provenance?')) return Promise.resolve(json(provenanceResponse()));
    return Promise.resolve(json({ detail: 'Unexpected request.' }, 500));
  }));
  const screen = await render(<DefinitionAuthoringPanel initialDefinition={definition} />);

  await screen.getByRole('button', { name: 'Review changes for 3.0.0' }).click();
  await expect.element(screen.getByRole('heading', { name: 'Release change review' })).toBeVisible();
  await expect.element(screen.getByLabelText('Comparing 2.0.0 to 3.0.0 in test')).toBeVisible();
  await expect.element(screen.getByText('$.workflow.steps[key="survey"].definition.title'))
    .toBeVisible();
  await expect.element(screen.getByText('"Candidate"')).toBeVisible();
  expect(requests[0]).toContain('/sha256%3Arelease-3/comparison?environmentName=test');
  await screen.getByRole('button', { name: 'Close review' }).click();
  await expect.element(screen.getByRole('heading', { name: 'Release change review' }))
    .not.toBeInTheDocument();
});

test('keeps comparison failures local to the review', async () => {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const path = String(input);
    if (path.endsWith('/draft')) return Promise.resolve(json(draftResponse()));
    if (path.includes('/comparison?')) {
      return Promise.resolve(json({ detail: 'Comparison is not permitted.' }, 403));
    }
    if (path.includes('/provenance?')) return Promise.resolve(json(provenanceResponse('ready')));
    return Promise.resolve(json({ detail: 'Unexpected request.' }, 500));
  }));
  const screen = await render(<DefinitionAuthoringPanel initialDefinition={definition} />);

  await screen.getByRole('button', { name: 'Review & activate' }).click();
  await expect.element(screen.getByRole('alert')).toHaveTextContent('Comparison is not permitted.');
  await expect.element(screen.getByRole('button', { name: 'Confirm activation' })).toBeDisabled();
  await expect.element(screen.getByRole('heading', { name: 'Release history' })).toBeVisible();
});

function draftResponse(): object {
  return {
    managedDefinitionName: 'onboarding', definition, definitionDigest: 'sha256:definition',
    version: 2, updatedBy: 'author', updatedAt: '2026-08-07T00:00:00Z', created: false,
  };
}

function provenanceResponse(candidateStatus = 'blocked'): object {
  return {
    managedDefinitionName: 'onboarding', createdBy: 'author',
    createdAt: '2026-08-07T00:00:00Z', environmentName: 'test', environments: ['test'],
    activation: {
      version: 2, releaseDigest: 'sha256:release-2', versionLabel: '2.0.0',
      activatedBy: 'operator', approvedBy: null, activatedAt: '2026-08-07T01:00:00Z',
    },
    revisions: page([]),
    releases: page([
      releaseResponse('sha256:release-3', '3.0.0', candidateStatus),
      releaseResponse('sha256:release-2', '2.0.0', 'active'),
    ]),
    auditEvents: page([]),
  };
}

function comparisonResponse(): object {
  return {
    environmentName: 'test',
    baseline: { digest: 'sha256:release-2', versionLabel: '2.0.0' },
    target: { digest: 'sha256:release-3', versionLabel: '3.0.0' },
    initialRelease: false,
    summary: { added: 1, removed: 0, changed: 1, total: 2 },
    changes: [{
      kind: 'changed', area: 'definition',
      path: '$.workflow.steps[key="survey"].definition.title',
      beforeValue: '"Current"', afterValue: '"Candidate"',
    }, {
      kind: 'added', area: 'bindings', path: '$.requiredBindings[0]',
      beforeValue: null, afterValue: '"crm"',
    }],
    truncated: false,
  };
}

function releaseResponse(digest: string, versionLabel: string, promotionStatus: string): object {
  return {
    digest, versionLabel, conformanceVersion: 1, installedAt: '2026-08-07T00:20:00Z',
    sourceRevisionNumbers: [1], requiredBindings: [], missingBindings: [], promotionStatus,
    canActivate: promotionStatus === 'ready', canRollback: false,
  };
}

function page(items: readonly object[]): object {
  return { items, nextCursor: null };
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status, headers: { 'content-type': 'application/json' },
  });
}
