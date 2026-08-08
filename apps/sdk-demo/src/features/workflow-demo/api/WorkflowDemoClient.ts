import type { SurveyDefinition, SurveySnapshot } from '@kajay/core';

export interface DemoWorkflowInstance {
  readonly id: string;
  readonly status: string;
  readonly activeStepKey: string;
  readonly version: number;
}

export class WorkflowDemoClient {
  async getDefinition(): Promise<SurveyDefinition> {
    const response = await fetch('/review-demo-survey.json');
    return readDefinition(await readJson(response));
  }

  start(): Promise<DemoWorkflowInstance> {
    return this.#send(
      '/workflow/api/environments/test/definitions/review-demo/instances',
      'POST',
    );
  }

  async get(instanceId: string): Promise<DemoWorkflowInstance> {
    const response = await fetch(`/workflow/api/instances/${encodeURIComponent(instanceId)}`);
    return readInstance(await readJson(response));
  }

  async submit(
    instance: DemoWorkflowInstance,
    snapshot: SurveySnapshot,
  ): Promise<DemoWorkflowInstance> {
    const path = `/workflow/api/instances/${encodeURIComponent(instance.id)}`;
    const saved = await this.#send(`${path}/response`, 'PUT', instance.version, { snapshot });
    return this.#send(`${path}/complete`, 'POST', saved.version);
  }

  async #send(
    path: string,
    method: 'POST' | 'PUT',
    version?: number,
    body?: unknown,
  ): Promise<DemoWorkflowInstance> {
    const headers = new Headers({ 'idempotency-key': `workflow-demo-${crypto.randomUUID()}` });
    if (version !== undefined) headers.set('if-match', `"${version}"`);
    if (body !== undefined) headers.set('content-type', 'application/json');
    const response = await fetch(path, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return readInstance(await readJson(response));
  }
}

function readDefinition(value: unknown): SurveyDefinition {
  if (!isObject(value)) throw new TypeError('Review demo definition must be an object.');
  return value as SurveyDefinition;
}

function readInstance(value: unknown): DemoWorkflowInstance {
  if (!isObject(value)) throw new TypeError('Workflow Instance response must be an object.');
  const id = value['id'];
  const status = value['status'];
  const activeStepKey = value['activeStepKey'];
  const version = value['version'];
  if (typeof id !== 'string' || typeof status !== 'string' || typeof activeStepKey !== 'string'
    || typeof version !== 'number' || !Number.isSafeInteger(version) || version < 0) {
    throw new TypeError('Workflow Instance response is invalid.');
  }
  return { id, status, activeStepKey, version };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(response: Response): Promise<unknown> {
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = isObject(value) && typeof value['detail'] === 'string'
      ? value['detail']
      : `Workflow demo returned ${response.status}.`;
    throw new Error(detail);
  }
  return value;
}
