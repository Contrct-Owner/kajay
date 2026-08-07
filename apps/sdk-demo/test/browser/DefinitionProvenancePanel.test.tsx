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

test('shows provenance and confirms a version-checked rollback', async () => {
  let rolledBack = false;
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.endsWith('/draft')) return Promise.resolve(json(draftResponse()));
    if (path.includes('/comparison?')) {
      return Promise.resolve(json(rollbackComparisonResponse()));
    }
    if (path.includes('/provenance?')) {
      return Promise.resolve(json(provenanceResponse(rolledBack)));
    }
    if (path.includes('/activations/')) {
      expect(new Headers(init?.headers).get('if-match')).toBe('"2"');
      expect(JSON.parse(String(init?.body))).toEqual({ releaseDigest: 'sha256:release-1' });
      rolledBack = true;
      return Promise.resolve(json({ version: 3 }));
    }
    return Promise.resolve(json({ detail: 'Unexpected request.' }, 500));
  });
  vi.stubGlobal('fetch', fetchMock);
  const screen = await render(<DefinitionAuthoringPanel initialDefinition={definition} />);

  await expect.element(screen.getByRole('heading', { name: 'Release history' })).toBeVisible();
  await expect.element(screen.getByText('Missing crm')).toBeVisible();
  await expect.element(screen.getByText('v2', { exact: true })).toBeVisible();
  await screen.getByRole('button', { name: 'Review & roll back' }).click();
  await expect.element(screen.getByText('Activate 1.0.0 in test?')).toBeVisible();
  await expect.element(screen.getByLabelText('Comparing 2.0.0 to 1.0.0 in test')).toBeVisible();
  await screen.getByRole('button', { name: 'Confirm rollback' }).click();
  await expect.element(screen.getByText('v3', { exact: true })).toBeVisible();
  expect(fetchMock).toHaveBeenCalled();
});

test('manages environment policy and write-only bindings', async () => {
  let environmentVersion = 1;
  let bindingConfigured = false;
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.endsWith('/draft')) return Promise.resolve(json(draftResponse()));
    if (path.includes('/provenance?')) return Promise.resolve(json(provenanceResponse(false)));
    if (path.endsWith('/environments/test/bindings') && init?.method === undefined) {
      return Promise.resolve(json(bindingConfigured ? [bindingResponse()] : []));
    }
    if (path.endsWith('/environments/test/bindings/crm')) {
      expect(new Headers(init?.headers).get('if-match')).toBe('"0"');
      expect(JSON.parse(String(init?.body))).toEqual({ reference: 'secret://test/crm' });
      bindingConfigured = true;
      return Promise.resolve(json(bindingResponse()));
    }
    if (path.endsWith('/environments/test') && init?.method === 'PUT') {
      expect(new Headers(init.headers).get('if-match')).toBe('"1"');
      environmentVersion = 2;
      return Promise.resolve(json(environmentResponse(environmentVersion, true)));
    }
    if (path.endsWith('/environments')) {
      return Promise.resolve(json([environmentResponse(environmentVersion, environmentVersion > 1)]));
    }
    return Promise.resolve(json({ detail: 'Unexpected request.' }, 500));
  });
  vi.stubGlobal('fetch', fetchMock);
  const screen = await render(<DefinitionAuthoringPanel initialDefinition={definition} />);

  await screen.getByRole('button', { name: 'Manage environments' }).click();
  await expect.element(screen.getByRole('heading', { name: 'Environment administration' }))
    .toBeVisible();
  await screen.getByLabelText('Require approval').last().click();
  await screen.getByRole('button', { name: 'Save policy' }).click();
  await expect.element(screen.getByText('Version 2; updated by environment-manager'))
    .toBeVisible();
  await screen.getByLabelText('Binding name').fill('crm');
  await screen.getByLabelText('Secret or configuration reference').fill('secret://test/crm');
  await screen.getByRole('button', { name: 'Set binding' }).click();
  await expect.element(screen.getByText('crm', { exact: true })).toBeVisible();
  expect(document.body.textContent).not.toContain('secret://test/crm');
});

test('pages and filters provenance history without reloading the workspace', async () => {
  const historyRequests: string[] = [];
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const path = String(input);
    if (path.endsWith('/draft')) return Promise.resolve(json(draftResponse()));
    if (path.includes('/provenance/revisions?')) {
      historyRequests.push(path);
      return Promise.resolve(json(page([revisionResponse(1)])));
    }
    if (path.includes('/provenance?')) {
      return Promise.resolve(json(provenanceResponse(false, 'revision-cursor')));
    }
    return Promise.resolve(json({ detail: 'Unexpected request.' }, 500));
  });
  vi.stubGlobal('fetch', fetchMock);
  const screen = await render(<DefinitionAuthoringPanel initialDefinition={definition} />);

  await screen.getByRole('button', { name: 'Load more Revision history' }).click();
  await expect.element(screen.getByText('Revision 1')).toBeVisible();
  expect(historyRequests[0]).toContain('cursor=revision-cursor');
  await screen.getByLabelText('Revision search').fill('AUTHOR');
  await screen.getByRole('button', { name: 'Apply Revision filters' }).click();
  await expect.poll(() => historyRequests.length).toBe(2);
  expect(historyRequests[1]).toContain('query=AUTHOR');
  expect(historyRequests[1]).not.toContain('cursor=');
});

function draftResponse(): object {
  return {
    managedDefinitionName: 'onboarding',
    definition,
    definitionDigest: 'sha256:definition-2',
    version: 2,
    updatedBy: 'author',
    updatedAt: '2026-08-06T00:00:00Z',
    created: false,
  };
}

function provenanceResponse(rolledBack: boolean, revisionCursor: string | null = null): object {
  const activeDigest = rolledBack ? 'sha256:release-1' : 'sha256:release-2';
  const activeLabel = rolledBack ? '1.0.0' : '2.0.0';
  return {
    managedDefinitionName: 'onboarding',
    createdBy: 'author',
    createdAt: '2026-08-06T00:00:00Z',
    environmentName: 'test',
    environments: ['test', 'production'],
    activation: {
      version: rolledBack ? 3 : 2,
      releaseDigest: activeDigest,
      versionLabel: activeLabel,
      activatedBy: 'release-manager',
      approvedBy: null,
      activatedAt: '2026-08-06T01:00:00Z',
    },
    revisions: page([revisionResponse(2)], revisionCursor),
    releases: page([
      releaseResponse('sha256:release-3', '3.0.0', 'blocked', false, ['crm']),
      releaseResponse('sha256:release-2', '2.0.0',
        rolledBack ? 'ready' : 'active', false, []),
      releaseResponse('sha256:release-1', '1.0.0',
        rolledBack ? 'active' : 'ready', !rolledBack, []),
    ]),
    auditEvents: page([{
      id: '0198f55b-b729-72f8-a4a8-130af0310f2f',
      subject: 'test/onboarding',
      eventType: 'definition-release-activated',
      payload: { releaseDigest: activeDigest, version: rolledBack ? 3 : 2 },
      actorId: 'release-manager',
      occurredAt: '2026-08-06T01:00:00Z',
    }]),
  };
}

function page(items: readonly object[], nextCursor: string | null = null): object {
  return { items, nextCursor };
}

function rollbackComparisonResponse(): object {
  return {
    environmentName: 'test',
    baseline: { digest: 'sha256:release-2', versionLabel: '2.0.0' },
    target: { digest: 'sha256:release-1', versionLabel: '1.0.0' },
    initialRelease: false,
    summary: { added: 0, removed: 0, changed: 1, total: 1 },
    changes: [{
      kind: 'changed', area: 'definition', path: '$.workflow.definition.title',
      beforeValue: '"Second"', afterValue: '"First"',
    }],
    truncated: false,
  };
}

function revisionResponse(number: number): object {
  return {
    number,
    sourceDraftVersion: number,
    definitionDigest: `sha256:definition-${number}`,
    createdBy: 'author',
    createdAt: '2026-08-06T00:10:00Z',
    releaseDigests: [`sha256:release-${number}`],
  };
}

function releaseResponse(
  digest: string,
  versionLabel: string,
  promotionStatus: string,
  canRollback: boolean,
  missingBindings: readonly string[],
): object {
  return {
    digest,
    versionLabel,
    conformanceVersion: 1,
    installedAt: '2026-08-06T00:20:00Z',
    sourceRevisionNumbers: [Number(versionLabel.slice(0, 1))],
    requiredBindings: missingBindings,
    missingBindings,
    promotionStatus,
    canActivate: promotionStatus !== 'active' && missingBindings.length === 0,
    canRollback,
  };
}

function environmentResponse(version: number, requiresApproval: boolean): object {
  return {
    name: 'test',
    displayName: 'Test',
    requiresApproval,
    position: 200,
    version,
    createdBy: 'environment-manager',
    createdAt: '2026-08-06T00:00:00Z',
    updatedBy: 'environment-manager',
    updatedAt: '2026-08-06T00:00:00Z',
  };
}

function bindingResponse(): object {
  return {
    environmentName: 'test',
    name: 'crm',
    version: 1,
    updatedBy: 'environment-manager',
    updatedAt: '2026-08-06T00:00:00Z',
  };
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
