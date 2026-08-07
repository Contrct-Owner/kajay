import type {
  DefinitionActivationState,
  CursorPage,
  DefinitionProvenance,
  DefinitionReleaseHistory,
  DefinitionRevisionHistory,
  ManagementAuditEvent,
  PromotionStatus,
} from './DefinitionAuthoringTypes.js';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`Definition provenance response requires ${name}.`);
  }
  return value;
}

function readOptionalString(value: unknown, name: string): string | undefined {
  return value === null ? undefined : readString(value, name);
}

function readNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`Definition provenance response requires a valid ${name}.`);
  }
  return value;
}

function readBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`Definition provenance response requires ${name}.`);
  }
  return value;
}

function readArray<T>(
  value: unknown,
  name: string,
  reader: (item: unknown, name: string) => T,
): readonly T[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`Definition provenance response requires ${name}.`);
  }
  return value.map((item, index) => reader(item, `${name}[${index}]`));
}

function readActivation(value: unknown, name: string): DefinitionActivationState {
  if (!isObject(value)) throw new TypeError(`Definition provenance response requires ${name}.`);
  return {
    version: readNumber(value['version'], `${name}.version`),
    releaseDigest: readOptionalString(value['releaseDigest'], `${name}.releaseDigest`),
    versionLabel: readOptionalString(value['versionLabel'], `${name}.versionLabel`),
    activatedBy: readOptionalString(value['activatedBy'], `${name}.activatedBy`),
    approvedBy: readOptionalString(value['approvedBy'], `${name}.approvedBy`),
    activatedAt: readOptionalString(value['activatedAt'], `${name}.activatedAt`),
  };
}

function readRevision(value: unknown, name: string): DefinitionRevisionHistory {
  if (!isObject(value)) throw new TypeError(`Definition provenance response requires ${name}.`);
  return {
    number: readNumber(value['number'], `${name}.number`),
    sourceDraftVersion: readNumber(value['sourceDraftVersion'], `${name}.sourceDraftVersion`),
    definitionDigest: readString(value['definitionDigest'], `${name}.definitionDigest`),
    createdBy: readString(value['createdBy'], `${name}.createdBy`),
    createdAt: readString(value['createdAt'], `${name}.createdAt`),
    releaseDigests: readArray(value['releaseDigests'], `${name}.releaseDigests`, readString),
  };
}

function readStatus(value: unknown, name: string): PromotionStatus {
  if (value !== 'active' && value !== 'ready' && value !== 'blocked') {
    throw new TypeError(`Definition provenance response requires a valid ${name}.`);
  }
  return value;
}

function readRelease(value: unknown, name: string): DefinitionReleaseHistory {
  if (!isObject(value)) throw new TypeError(`Definition provenance response requires ${name}.`);
  return {
    digest: readString(value['digest'], `${name}.digest`),
    versionLabel: readString(value['versionLabel'], `${name}.versionLabel`),
    conformanceVersion: readNumber(value['conformanceVersion'], `${name}.conformanceVersion`),
    installedAt: readString(value['installedAt'], `${name}.installedAt`),
    sourceRevisionNumbers: readArray(
      value['sourceRevisionNumbers'], `${name}.sourceRevisionNumbers`, readNumber,
    ),
    requiredBindings: readArray(value['requiredBindings'], `${name}.requiredBindings`, readString),
    missingBindings: readArray(value['missingBindings'], `${name}.missingBindings`, readString),
    promotionStatus: readStatus(value['promotionStatus'], `${name}.promotionStatus`),
    canActivate: readBoolean(value['canActivate'], `${name}.canActivate`),
    canRollback: readBoolean(value['canRollback'], `${name}.canRollback`),
  };
}

function readAudit(value: unknown, name: string): ManagementAuditEvent {
  if (!isObject(value)) throw new TypeError(`Definition provenance response requires ${name}.`);
  const payload = value['payload'];
  if (!isObject(payload)) throw new TypeError(`Definition provenance response requires ${name}.payload.`);
  return {
    id: readString(value['id'], `${name}.id`),
    subject: readString(value['subject'], `${name}.subject`),
    eventType: readString(value['eventType'], `${name}.eventType`),
    payload,
    actorId: readString(value['actorId'], `${name}.actorId`),
    occurredAt: readString(value['occurredAt'], `${name}.occurredAt`),
  };
}

function readPage<T>(
  value: unknown,
  name: string,
  reader: (item: unknown, itemName: string) => T,
): CursorPage<T> {
  if (!isObject(value)) throw new TypeError(`Definition provenance response requires ${name}.`);
  return {
    items: readArray(value['items'], `${name}.items`, reader),
    nextCursor: readOptionalString(value['nextCursor'], `${name}.nextCursor`),
  };
}

export const readRevisionPage = (value: unknown): CursorPage<DefinitionRevisionHistory> =>
  readPage(value, 'revisions', readRevision);

export const readReleasePage = (value: unknown): CursorPage<DefinitionReleaseHistory> =>
  readPage(value, 'releases', readRelease);

export const readAuditPage = (value: unknown): CursorPage<ManagementAuditEvent> =>
  readPage(value, 'auditEvents', readAudit);

export function readDefinitionProvenance(value: unknown): DefinitionProvenance {
  if (!isObject(value)) throw new TypeError('Definition provenance response must be an object.');
  return {
    managedDefinitionName: readString(value['managedDefinitionName'], 'managedDefinitionName'),
    createdBy: readString(value['createdBy'], 'createdBy'),
    createdAt: readString(value['createdAt'], 'createdAt'),
    environmentName: readString(value['environmentName'], 'environmentName'),
    environments: readArray(value['environments'], 'environments', readString),
    activation: readActivation(value['activation'], 'activation'),
    revisions: readRevisionPage(value['revisions']),
    releases: readReleasePage(value['releases']),
    auditEvents: readAuditPage(value['auditEvents']),
  };
}
