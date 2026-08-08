/// <reference types="@vitest/browser/matchers" />
import { afterEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { WorkflowDemoPanel } from '../../src/features/workflow-demo/index.js';

const instanceId = '019fdd53-bc03-767a-8ebf-bf1659abf511';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

test('respondent starts the seeded workflow and submits an immutable attempt for review', async () => {
  let version = 0;
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.endsWith('/review-demo-survey.json')) {
      return Promise.resolve(json({
        schemaVersion: 1,
        title: 'Review onboarding',
        pages: [{
          name: 'profile',
          elements: [{ type: 'text', name: 'fullName', title: 'Full name', required: true }],
        }],
      }));
    }
    if (path.endsWith('/environments/test/definitions/review-demo/instances')) {
      version = 1;
      return Promise.resolve(json(instance('active', version)));
    }
    if (path.endsWith(`/instances/${instanceId}/response`)) {
      expect(init?.method).toBe('PUT');
      expect(new Headers(init.headers).get('if-match')).toBe('"1"');
      const body = JSON.parse(String(init.body)) as { readonly snapshot: unknown };
      expect(body.snapshot).toBeDefined();
      version = 2;
      return Promise.resolve(json(instance('active', version)));
    }
    if (path.endsWith(`/instances/${instanceId}/complete`)) {
      expect(init?.method).toBe('POST');
      expect(new Headers(init.headers).get('if-match')).toBe('"2"');
      version = 3;
      return Promise.resolve(json(instance('waiting-review', version)));
    }
    return Promise.resolve(json({ detail: `Unexpected request: ${path}` }, 500));
  });
  vi.stubGlobal('fetch', fetchMock);
  const screen = await render(<WorkflowDemoPanel />);

  await screen.getByRole('button', { name: 'Start review demo' }).click();
  await screen.getByLabelText('Full name').fill('Ada Lovelace');
  await screen.getByRole('button', { name: 'Complete' }).click();

  await expect.element(screen.getByRole('status')).toHaveTextContent('Waiting for human review');
  expect(localStorage.getItem('kajay-review-demo-instance')).toBe(instanceId);
  expect(fetchMock).toHaveBeenCalledTimes(4);
});

function instance(status: string, currentVersion: number): object {
  return {
    id: instanceId,
    environmentName: 'test',
    managedDefinitionName: 'review-demo',
    releaseDigest: `sha256:${'b'.repeat(64)}`,
    status,
    activeStepKey: status === 'active' ? 'survey' : 'review',
    responseSnapshot: null,
    version: currentVersion,
  };
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
