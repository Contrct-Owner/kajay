import { ReviewWorkbenchError } from './ReviewWorkbenchError.js';
import type {
  ReviewDecisionInput,
  ReviewQueuePage,
  ReviewQueueRequest,
  ReviewTaskDetail,
  WorkflowInstance,
} from './ReviewWorkbenchTypes.js';
import {
  readProblemDetail,
  readReviewQueuePage,
  readReviewTaskDetail,
} from './reviewWorkbenchSchemas.js';

export class ReviewWorkbenchClient {
  readonly #basePath: string;

  constructor(basePath = '/workflow/api') {
    this.#basePath = basePath;
  }

  async getTasks(request: ReviewQueueRequest): Promise<ReviewQueuePage> {
    const query = new URLSearchParams({
      status: request.status,
      limit: String(request.limit ?? 20),
    });
    if (request.managedDefinitionName !== undefined) {
      query.set('managedDefinitionName', validateManagedName(request.managedDefinitionName));
    }
    if (request.createdAfter !== undefined) query.set('createdAfter', request.createdAfter);
    if (request.cursor !== undefined) query.set('cursor', request.cursor);
    const response = await fetch(`${this.#basePath}/reviews?${query}`);
    return readReviewQueuePage(await readJson(response));
  }

  async getTask(taskId: string): Promise<ReviewTaskDetail> {
    const response = await fetch(`${this.#basePath}/reviews/${encodeURIComponent(taskId)}`);
    return readReviewTaskDetail(await readJson(response));
  }

  async decide(
    detail: ReviewTaskDetail,
    input: ReviewDecisionInput,
  ): Promise<WorkflowInstance> {
    const comment = validateDecision(input);
    const headers = new Headers({
      'content-type': 'application/json',
      'idempotency-key': `review-${crypto.randomUUID()}`,
      'if-match': `"${detail.instance.version}"`,
    });
    const response = await fetch(
      `${this.#basePath}/instances/${encodeURIComponent(detail.instance.id)}`
        + `/reviews/${encodeURIComponent(detail.task.id)}/decisions`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ decision: input.decision, comment }),
      },
    );
    return readWorkflowInstance(await readJson(response));
  }
}

function validateManagedName(value: string): string {
  const name = value.trim();
  if (name.length === 0 || name.length > 128) {
    throw new TypeError('Managed Definition name must contain 1 to 128 characters.');
  }
  return name;
}

function validateDecision(input: ReviewDecisionInput): string | undefined {
  const comment = input.comment?.trim();
  if (comment !== undefined && comment.length > 2000) {
    throw new TypeError('A decision comment cannot exceed 2000 characters.');
  }
  if (input.decision === 'request-changes' && (comment?.length ?? 0) === 0) {
    throw new TypeError('Requesting changes requires a comment.');
  }
  return comment?.length === 0 ? undefined : comment;
}

function readWorkflowInstance(value: unknown): WorkflowInstance {
  const source = asObject(value);
  return {
    id: readString(source['id'], 'Workflow Instance id'),
    environmentName: readString(source['environmentName'], 'Environment name'),
    managedDefinitionName: readString(source['managedDefinitionName'], 'Managed Definition name'),
    releaseDigest: readString(source['releaseDigest'], 'Release digest'),
    status: readString(source['status'], 'Workflow status'),
    activeStepKey: readString(source['activeStepKey'], 'Active step key'),
    version: readVersion(source['version']),
  };
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Workflow Instance response must be an object.');
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${name} is required.`);
  return value;
}

function readVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError('Workflow version is invalid.');
  }
  return value;
}

async function readJson(response: Response): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ReviewWorkbenchError(
      response.status,
      readProblemDetail(body) ?? `Review workbench returned ${response.status}.`,
    );
  }
  return body;
}
