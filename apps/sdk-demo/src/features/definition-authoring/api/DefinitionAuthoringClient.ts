import type { SurveyDefinition } from '@kajay/core';
import type {
  DefinitionDraft,
  DefinitionProvenance,
  DefinitionRelease,
  DefinitionRevision,
} from './DefinitionAuthoringTypes.js';
import { DefinitionAuthoringError } from './DefinitionAuthoringError.js';
import {
  readDefinitionDraft,
  readDefinitionRelease,
  readDefinitionRevision,
  readProblemDetail,
} from './definitionAuthoringSchemas.js';
import { readDefinitionProvenance } from './definitionProvenanceSchemas.js';

export class DefinitionAuthoringClient {
  readonly #basePath: string;

  constructor(basePath = '/workflow/api/management') {
    this.#basePath = basePath;
  }

  async getDraft(managedName: string): Promise<DefinitionDraft | undefined> {
    const response = await fetch(`${this.#definitionPath(managedName)}/draft`);
    if (response.status === 404) return undefined;
    return readDefinitionDraft(await readJson(response));
  }

  async saveDraft(
    managedName: string,
    version: number,
    definition: SurveyDefinition,
  ): Promise<DefinitionDraft> {
    return readDefinitionDraft(await this.#send(
      `${this.#definitionPath(managedName)}/draft`,
      { method: 'PUT', version, body: { definition } },
    ));
  }

  async checkpoint(managedName: string, version: number): Promise<DefinitionRevision> {
    return readDefinitionRevision(await this.#send(
      `${this.#definitionPath(managedName)}/revisions`,
      { method: 'POST', version },
    ));
  }

  async createRelease(
    managedName: string,
    revision: number,
    versionLabel: string,
  ): Promise<DefinitionRelease> {
    const label = validateVersionLabel(versionLabel);
    return readDefinitionRelease(await this.#send(
      `${this.#definitionPath(managedName)}/revisions/${revision}/releases`,
      { method: 'POST', body: { versionLabel: label, requiredBindings: [] } },
    ));
  }

  async getProvenance(
    managedName: string,
    environmentName: string,
  ): Promise<DefinitionProvenance | undefined> {
    const environment = validateName(environmentName, 'Environment');
    const query = new URLSearchParams({ environmentName: environment });
    const response = await fetch(`${this.#definitionPath(managedName)}/provenance?${query}`);
    if (response.status === 404) return undefined;
    return readDefinitionProvenance(await readJson(response));
  }

  async rollback(
    managedName: string,
    environmentName: string,
    releaseDigest: string,
    expectedVersion: number,
  ): Promise<void> {
    const environment = validateName(environmentName, 'Environment');
    await this.#send(
      `${this.#basePath}/environments/${encodeURIComponent(environment)}`
        + `/activations/${encodeURIComponent(managedName)}`,
      { method: 'PUT', version: expectedVersion, body: { releaseDigest } },
    );
  }

  #definitionPath(managedName: string): string {
    return `${this.#basePath}/definitions/${encodeURIComponent(managedName)}`;
  }

  async #send(
    path: string,
    options: AuthoringRequest,
  ): Promise<unknown> {
    const headers = new Headers({ 'content-type': 'application/json' });
    if (options.version !== undefined) headers.set('if-match', `"${options.version}"`);
    const response = await fetch(path, {
      method: options.method,
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    return readJson(response);
  }
}

interface AuthoringRequest {
  readonly method: 'POST' | 'PUT';
  readonly version?: number;
  readonly body?: unknown;
}

async function readJson(response: Response): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = readProblemDetail(body)
      ?? `Definition authoring returned ${response.status} ${response.statusText}.`;
    throw new DefinitionAuthoringError(response.status, message);
  }
  return body;
}

function validateVersionLabel(value: string): string {
  const label = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(label)) {
    throw new TypeError('Version label must start with a letter or number and use ._- only.');
  }
  return label;
}

function validateName(value: string, label: string): string {
  const name = value.trim();
  if (name.length === 0 || name.length > 128) {
    throw new TypeError(`${label} must contain 1 to 128 characters.`);
  }
  return name;
}
