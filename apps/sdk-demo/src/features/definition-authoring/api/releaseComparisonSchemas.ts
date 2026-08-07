import type {
  DefinitionReleaseChange,
  DefinitionReleaseChangeArea,
  DefinitionReleaseChangeKind,
  DefinitionReleaseChangeSummary,
  DefinitionReleaseComparison,
  DefinitionReleaseComparisonTarget,
} from './DefinitionAuthoringTypes.js';

export function readReleaseComparison(value: unknown): DefinitionReleaseComparison {
  const root = readObject(value, 'release comparison');
  const baseline = root['baseline'] === null
    ? undefined
    : readTarget(root['baseline'], 'baseline');
  const initialRelease = readBoolean(root['initialRelease'], 'initialRelease');
  if (initialRelease !== (baseline === undefined)) {
    throw new TypeError('Release comparison initial state does not match its baseline.');
  }
  const summary = readSummary(root['summary']);
  const changes = readChanges(root['changes']);
  if (summary.total !== changes.length) {
    throw new TypeError('Release comparison summary does not match its changes.');
  }
  return {
    environmentName: readString(root['environmentName'], 'environmentName'),
    baseline,
    target: readTarget(root['target'], 'target'),
    initialRelease,
    summary,
    changes,
    truncated: readBoolean(root['truncated'], 'truncated'),
  };
}

function readTarget(value: unknown, name: string): DefinitionReleaseComparisonTarget {
  const target = readObject(value, name);
  return {
    digest: readString(target['digest'], `${name}.digest`),
    versionLabel: readString(target['versionLabel'], `${name}.versionLabel`),
  };
}

function readSummary(value: unknown): DefinitionReleaseChangeSummary {
  const summary = readObject(value, 'summary');
  const result = {
    added: readCount(summary['added'], 'summary.added'),
    removed: readCount(summary['removed'], 'summary.removed'),
    changed: readCount(summary['changed'], 'summary.changed'),
    total: readCount(summary['total'], 'summary.total'),
  };
  if (result.total !== result.added + result.removed + result.changed) {
    throw new TypeError('Release comparison summary total is inconsistent.');
  }
  return result;
}

function readChanges(value: unknown): readonly DefinitionReleaseChange[] {
  if (!Array.isArray(value)) throw new TypeError('Release comparison requires changes.');
  return value.map((item, index) => readChange(item, `changes[${index}]`));
}

function readChange(value: unknown, name: string): DefinitionReleaseChange {
  const change = readObject(value, name);
  const kind = readKind(change['kind'], `${name}.kind`);
  const beforeValue = readOptionalString(change['beforeValue'], `${name}.beforeValue`);
  const afterValue = readOptionalString(change['afterValue'], `${name}.afterValue`);
  if ((kind === 'added' && (beforeValue !== undefined || afterValue === undefined))
    || (kind === 'removed' && (beforeValue === undefined || afterValue !== undefined))
    || (kind === 'changed' && (beforeValue === undefined || afterValue === undefined))) {
    throw new TypeError(`Release comparison ${name} has inconsistent values.`);
  }
  return {
    kind,
    area: readArea(change['area'], `${name}.area`),
    path: readString(change['path'], `${name}.path`),
    beforeValue,
    afterValue,
  };
}

function readKind(value: unknown, name: string): DefinitionReleaseChangeKind {
  if (value !== 'added' && value !== 'removed' && value !== 'changed') {
    throw new TypeError(`Release comparison requires ${name}.`);
  }
  return value;
}

function readArea(value: unknown, name: string): DefinitionReleaseChangeArea {
  if (value !== 'definition' && value !== 'workflow'
    && value !== 'bindings' && value !== 'compatibility') {
    throw new TypeError(`Release comparison requires ${name}.`);
  }
  return value;
}

function readObject(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`Release comparison requires ${name}.`);
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`Release comparison requires ${name}.`);
  }
  return value;
}

function readOptionalString(value: unknown, name: string): string | undefined {
  return value === null ? undefined : readString(value, name);
}

function readCount(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`Release comparison requires ${name}.`);
  }
  return value;
}

function readBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new TypeError(`Release comparison requires ${name}.`);
  return value;
}
