import type { IncomingMessage } from 'node:http';

const maximumBodyBytes = 1_048_576;

export async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maximumBodyBytes) throw new DemoHttpRequestError(413, 'Request body is too large.');
    chunks.push(bytes);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new DemoHttpRequestError(400, 'Request body must be valid JSON.');
  }
}

export function readObject(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DemoHttpRequestError(400, `${label} must be a JSON object.`);
  }
  return value as Readonly<Record<string, unknown>>;
}

export function readQuestionNames(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some((name) => typeof name !== 'string')) {
    throw new DemoHttpRequestError(400, 'questionNames must be an array of strings.');
  }
  return value;
}

export class DemoHttpRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
