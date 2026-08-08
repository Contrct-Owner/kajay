/// <reference types="@vitest/browser/matchers" />
import { parseSurvey } from '@kajay/core';
import { afterEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { ReviewWorkbenchPanel } from '../../src/features/review-workbench/index.js';

const definition = {
  title: 'Onboarding review',
  pages: [{
    name: 'profile',
    elements: [{ type: 'text', name: 'fullName', title: 'Full name' }],
  }],
} as const;
const definitionDigest = parseSurvey(definition).definitionDigest;
const taskId = '019fdd53-bc03-767a-8ebf-bf1659abf50e';
const instanceId = '019fdd53-bc03-767a-8ebf-bf1659abf50f';

afterEach(() => {
  vi.unstubAllGlobals();
});

test('reviewer opens a pinned submission and requests changes with concurrency protection', async () => {
  let decided = false;
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path === `/workflow/api/reviews/${taskId}`) {
      return Promise.resolve(json(detailResponse()));
    }
    if (path.endsWith(`/${instanceId}/reviews/${taskId}/decisions`)) {
      expect(init?.method).toBe('POST');
      expect(new Headers(init.headers).get('if-match')).toBe('"2"');
      expect(new Headers(init.headers).get('idempotency-key')).toMatch(/^review-/u);
      expect(JSON.parse(String(init.body))).toEqual({
        decision: 'request-changes',
        comment: 'Please include your legal name.',
      });
      decided = true;
      return Promise.resolve(json({ ...instanceResponse(), status: 'active', version: 3 }));
    }
    if (path.startsWith('/workflow/api/reviews?')) {
      return Promise.resolve(json(page(decided ? [] : [queueItemResponse()])));
    }
    return Promise.resolve(json({ detail: `Unexpected request: ${path}` }, 500));
  });
  vi.stubGlobal('fetch', fetchMock);
  const screen = await render(<ReviewWorkbenchPanel />);

  await expect.element(screen.getByRole('heading', { name: 'Review tasks' })).toBeVisible();
  await screen.getByRole('button', { name: /Review onboarding round 1/u }).click();
  await expect.element(screen.getByRole('heading', { name: 'Onboarding review' })).toBeVisible();
  await expect.element(screen.getByLabelText('Full name')).toHaveValue('Ada Lovelace');
  await expect.element(screen.getByLabelText('Full name')).toHaveAttribute('readonly');
  await screen.getByLabelText('Decision comment').fill('Please include your legal name.');
  await screen.getByRole('button', { name: 'Request changes' }).click();
  await expect.element(screen.getByText('No pending review tasks.')).toBeVisible();
  expect(fetchMock).toHaveBeenCalled();
});

test('requesting changes requires an actionable comment', async () => {
  let decisionRequested = false;
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path === `/workflow/api/reviews/${taskId}`) {
      return Promise.resolve(json(detailResponse()));
    }
    if (init?.method === 'POST') decisionRequested = true;
    return Promise.resolve(json(page([queueItemResponse()])));
  }));
  const screen = await render(<ReviewWorkbenchPanel />);

  await screen.getByRole('button', { name: /Review onboarding round 1/u }).click();
  await screen.getByRole('button', { name: 'Request changes' }).click();

  await expect.element(screen.getByRole('alert')).toHaveTextContent(
    'Explain what the respondent needs to change.',
  );
  expect(decisionRequested).toBe(false);
});

test('a stale task remains open and tells the reviewer to refresh', async () => {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path === `/workflow/api/reviews/${taskId}`) {
      return Promise.resolve(json(detailResponse()));
    }
    if (init?.method === 'POST') {
      return Promise.resolve(json({ detail: 'Version changed.' }, 412));
    }
    return Promise.resolve(json(page([queueItemResponse()])));
  }));
  const screen = await render(<ReviewWorkbenchPanel />);

  await screen.getByRole('button', { name: /Review onboarding round 1/u }).click();
  await screen.getByRole('button', { name: 'Approve' }).click();

  await expect.element(screen.getByRole('alert')).toHaveTextContent(
    'This workflow changed. Refresh the task before deciding.',
  );
  await expect.element(screen.getByRole('button', { name: 'Approve' })).toBeVisible();
});

function queueItemResponse(): object {
  return {
    task: taskResponse(),
    environmentName: 'test',
    managedDefinitionName: 'onboarding',
    releaseDigest: `sha256:${'b'.repeat(64)}`,
    workflowStatus: 'waiting-review',
    activeStepKey: 'review',
    workflowVersion: 2,
  };
}

function detailResponse(): object {
  return {
    task: taskResponse(),
    instance: instanceResponse(),
    submission: {
      id: '019fdd53-bc03-767a-8ebf-bf1659abf510',
      workflowInstanceId: instanceId,
      stepKey: 'survey',
      attemptNumber: 1,
      definitionDigest,
      snapshot: {
        formatVersion: 1,
        definitionDigest,
        conformanceVersion: 2,
        data: { fullName: { kind: 'json', value: 'Ada Lovelace' } },
        pageName: 'profile',
        locale: 'en',
        lifecycle: 'completed',
        timer: null,
      },
      submittedBy: 'respondent',
      submittedAt: '2026-08-07T17:00:00Z',
    },
    definition,
    reviewRounds: [taskResponse()],
    reviewRoundsTruncated: false,
    auditHistory: [{
      sequence: 3,
      eventType: 'survey-step-completed',
      payload: { stepKey: 'survey' },
      actorId: 'respondent',
      occurredAt: '2026-08-07T17:00:00Z',
    }],
    auditHistoryTruncated: false,
  };
}

function taskResponse(): object {
  return {
    id: taskId,
    workflowInstanceId: instanceId,
    submissionId: '019fdd53-bc03-767a-8ebf-bf1659abf510',
    stepKey: 'review',
    roundNumber: 1,
    assignedPermission: 'kajay:workflow:review',
    status: 'pending',
    createdAt: '2026-08-07T17:00:01Z',
    decidedBy: null,
    decidedAt: null,
    comment: null,
  };
}

function instanceResponse(): object {
  return {
    id: instanceId,
    environmentName: 'test',
    managedDefinitionName: 'onboarding',
    releaseDigest: `sha256:${'b'.repeat(64)}`,
    status: 'waiting-review',
    activeStepKey: 'review',
    responseSnapshot: null,
    version: 2,
  };
}

function page(items: readonly object[]): object {
  return { items, nextCursor: null };
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
