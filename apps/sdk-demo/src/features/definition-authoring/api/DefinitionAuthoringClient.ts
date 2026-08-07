import type { SurveyDefinition } from '@kajay/core';
import type {
  DefinitionDraft,
  DefinitionProvenance,
  DefinitionRelease,
  DefinitionReleaseHistory,
  DefinitionRevision,
  DefinitionRevisionHistory,
  CursorPage,
  EnvironmentBinding,
  HistoryPageRequest,
  ManagedEnvironment,
  ManagementAuditEvent,
  ReleaseHistoryPageRequest,
  ReleasePreflight,
} from './DefinitionAuthoringTypes.js';
import { DefinitionAuthoringError } from './DefinitionAuthoringError.js';
import {
  readDefinitionDraft,
  readDefinitionRelease,
  readDefinitionRevision,
  readProblemDetail,
} from './definitionAuthoringSchemas.js';
import {
  readAuditPage,
  readDefinitionProvenance,
  readReleasePage,
  readRevisionPage,
} from './definitionProvenanceSchemas.js';
import { readReleasePreflight } from './releasePreflightSchemas.js';
import {
  readBinding,
  readBindings,
  readEnvironment,
  readEnvironments,
} from './environmentSchemas.js';

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

  async getRevisions(
    managedName: string,
    request: HistoryPageRequest,
  ): Promise<CursorPage<DefinitionRevisionHistory>> {
    return readRevisionPage(await this.#getHistory(managedName, 'revisions', request));
  }

  async getReleases(
    managedName: string,
    environmentName: string,
    request: ReleaseHistoryPageRequest,
  ): Promise<CursorPage<DefinitionReleaseHistory>> {
    const environment = validateName(environmentName, 'Environment');
    return readReleasePage(await this.#getHistory(
      managedName, 'releases', { ...request, environmentName: environment },
    ));
  }

  async getAuditEvents(
    managedName: string,
    environmentName: string,
    request: HistoryPageRequest,
  ): Promise<CursorPage<ManagementAuditEvent>> {
    const environment = validateName(environmentName, 'Environment');
    return readAuditPage(await this.#getHistory(
      managedName, 'audit', { ...request, environmentName: environment },
    ));
  }

  async activate(
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

  async preflight(
    environmentName: string,
    releaseDigest: string,
  ): Promise<ReleasePreflight> {
    const environment = validateName(environmentName, 'Environment');
    const query = new URLSearchParams({ environmentName: environment });
    return readReleasePreflight(await this.#send(
      `${this.#basePath}/releases/${encodeURIComponent(releaseDigest)}/preflight?${query}`,
      { method: 'POST' },
    ));
  }

  async getEnvironments(): Promise<readonly ManagedEnvironment[]> {
    const response = await fetch(`${this.#basePath}/environments`);
    return readEnvironments(await readJson(response));
  }

  async createEnvironment(input: EnvironmentInput): Promise<ManagedEnvironment> {
    return readEnvironment(await this.#send(
      `${this.#basePath}/environments`, { method: 'POST', body: input },
    ));
  }

  async updateEnvironment(
    name: string,
    version: number,
    input: Omit<EnvironmentInput, 'name'>,
  ): Promise<ManagedEnvironment> {
    return readEnvironment(await this.#send(
      `${this.#basePath}/environments/${encodeURIComponent(name)}`,
      { method: 'PUT', version, body: input },
    ));
  }

  async getBindings(environmentName: string): Promise<readonly EnvironmentBinding[]> {
    const path = this.#environmentPath(environmentName);
    const response = await fetch(`${path}/bindings`);
    return readBindings(await readJson(response));
  }

  async setBinding(
    environmentName: string,
    name: string,
    reference: string,
    version: number,
  ): Promise<EnvironmentBinding> {
    return readBinding(await this.#send(
      `${this.#environmentPath(environmentName)}/bindings/${encodeURIComponent(name)}`,
      { method: 'PUT', version, body: { reference } },
    ));
  }

  async removeBinding(
    environmentName: string,
    name: string,
    version: number,
  ): Promise<void> {
    const headers = new Headers({ 'if-match': `"${version}"` });
    const response = await fetch(
      `${this.#environmentPath(environmentName)}/bindings/${encodeURIComponent(name)}`,
      { method: 'DELETE', headers },
    );
    if (!response.ok) await readJson(response);
  }

  #definitionPath(managedName: string): string {
    return `${this.#basePath}/definitions/${encodeURIComponent(managedName)}`;
  }

  async #getHistory(
    managedName: string,
    collection: string,
    request: HistoryPageRequest & { readonly environmentName?: string },
  ): Promise<unknown> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(request)) {
      if (value !== undefined && value !== '') query.set(key, String(value));
    }
    const response = await fetch(
      `${this.#definitionPath(managedName)}/provenance/${collection}?${query}`,
    );
    return readJson(response);
  }

  #environmentPath(environmentName: string): string {
    const name = validateName(environmentName, 'Environment');
    return `${this.#basePath}/environments/${encodeURIComponent(name)}`;
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

export interface EnvironmentInput {
  readonly name: string;
  readonly displayName: string;
  readonly requiresApproval: boolean;
  readonly position: number;
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
