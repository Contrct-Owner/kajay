import type {
  EnvironmentBinding,
  ManagedEnvironment,
} from './DefinitionAuthoringTypes.js';

export function readEnvironments(value: unknown): readonly ManagedEnvironment[] {
  return readArray(value, 'environments', readEnvironment);
}

export function readEnvironment(value: unknown, name = 'environment'): ManagedEnvironment {
  if (!isObject(value)) throw new TypeError(`Environment response requires ${name}.`);
  return {
    name: readString(value['name'], `${name}.name`),
    displayName: readString(value['displayName'], `${name}.displayName`),
    requiresApproval: readBoolean(value['requiresApproval'], `${name}.requiresApproval`),
    position: readNumber(value['position'], `${name}.position`),
    version: readNumber(value['version'], `${name}.version`),
    createdBy: readString(value['createdBy'], `${name}.createdBy`),
    createdAt: readString(value['createdAt'], `${name}.createdAt`),
    updatedBy: readString(value['updatedBy'], `${name}.updatedBy`),
    updatedAt: readString(value['updatedAt'], `${name}.updatedAt`),
  };
}

export function readBindings(value: unknown): readonly EnvironmentBinding[] {
  return readArray(value, 'bindings', readBinding);
}

export function readBinding(value: unknown, name = 'binding'): EnvironmentBinding {
  if (!isObject(value)) throw new TypeError(`Environment binding response requires ${name}.`);
  return {
    environmentName: readString(value['environmentName'], `${name}.environmentName`),
    name: readString(value['name'], `${name}.name`),
    version: readNumber(value['version'], `${name}.version`),
    updatedBy: readString(value['updatedBy'], `${name}.updatedBy`),
    updatedAt: readString(value['updatedAt'], `${name}.updatedAt`),
  };
}

function readArray<T>(
  value: unknown,
  name: string,
  reader: (item: unknown, name: string) => T,
): readonly T[] {
  if (!Array.isArray(value)) throw new TypeError(`Environment response requires ${name}.`);
  return value.map((item, index) => reader(item, `${name}[${index}]`));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`Environment response requires ${name}.`);
  }
  return value;
}

function readBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new TypeError(`Environment response requires ${name}.`);
  return value;
}

function readNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`Environment response requires ${name}.`);
  }
  return value;
}
