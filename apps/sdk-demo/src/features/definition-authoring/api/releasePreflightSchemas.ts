import type { ReleasePreflight } from './DefinitionAuthoringTypes.js';

export function readReleasePreflight(value: unknown): ReleasePreflight {
  if (!isObject(value)) throw new TypeError('Release preflight response must be an object.');
  return {
    digest: readString(value['digest'], 'digest'),
    managedDefinitionName: readString(value['managedDefinitionName'], 'managedDefinitionName'),
    versionLabel: readString(value['versionLabel'], 'versionLabel'),
    compatible: readBoolean(value['compatible'], 'compatible'),
    missingBindings: readStrings(value['missingBindings'], 'missingBindings'),
    requiresApproval: readBoolean(value['requiresApproval'], 'requiresApproval'),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`Release preflight response requires ${name}.`);
  }
  return value;
}

function readBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`Release preflight response requires ${name}.`);
  }
  return value;
}

function readStrings(value: unknown, name: string): readonly string[] {
  if (!Array.isArray(value)) throw new TypeError(`Release preflight requires ${name}.`);
  return value.map((item, index) => readString(item, `${name}[${index}]`));
}
