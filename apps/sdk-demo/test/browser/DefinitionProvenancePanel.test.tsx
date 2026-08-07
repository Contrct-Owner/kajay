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
  await screen.getByRole('button', { name: 'Roll back' }).click();
  await expect.element(screen.getByText('Activate 1.0.0 in test?')).toBeVisible();
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

function provenanceResponse(rolledBack: boolean): object {
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
    revisions: [revisionResponse(2), revisionResponse(1)],
    releases: [
      releaseResponse('sha256:release-3', '3.0.0', 'blocked', false, ['crm']),
      releaseResponse('sha256:release-2', '2.0.0',
        rolledBack ? 'ready' : 'active', false, []),
      releaseResponse('sha256:release-1', '1.0.0',
        rolledBack ? 'active' : 'ready', !rolledBack, []),
    ],
    auditEvents: [{
      id: '0198f55b-b729-72f8-a4a8-130af0310f2f',
      subject: 'test/onboarding',
      eventType: 'definition-release-activated',
      payload: { releaseDigest: activeDigest, version: rolledBack ? 3 : 2 },
      actorId: 'release-manager',
      occurredAt: '2026-08-06T01:00:00Z',
    }],
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
