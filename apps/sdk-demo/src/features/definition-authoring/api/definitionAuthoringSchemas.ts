import type { SurveyDefinition } from '@kajay/core';
import type {
  DefinitionDraft,
  DefinitionRelease,
  DefinitionRevision,
} from './DefinitionAuthoringTypes.js';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`Definition authoring response requires ${name}.`);
  }
  return value;
}

function readNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`Definition authoring response requires a valid ${name}.`);
  }
  return value;
}

function readBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`Definition authoring response requires ${name}.`);
  }
  return value;
}

function readDefinition(value: unknown): SurveyDefinition {
  if (!isObject(value)) {
    throw new TypeError('Definition authoring response requires a definition object.');
  }
  return value as SurveyDefinition;
}

export function readDefinitionDraft(value: unknown): DefinitionDraft {
  if (!isObject(value)) throw new TypeError('Definition draft response must be an object.');
  return {
    managedDefinitionName: readString(value['managedDefinitionName'], 'managedDefinitionName'),
    definition: readDefinition(value['definition']),
    definitionDigest: readString(value['definitionDigest'], 'definitionDigest'),
    version: readNumber(value['version'], 'version'),
    updatedBy: readString(value['updatedBy'], 'updatedBy'),
    updatedAt: readString(value['updatedAt'], 'updatedAt'),
    created: readBoolean(value['created'], 'created'),
  };
}

export function readDefinitionRevision(value: unknown): DefinitionRevision {
  if (!isObject(value)) throw new TypeError('Definition revision response must be an object.');
  return {
    managedDefinitionName: readString(value['managedDefinitionName'], 'managedDefinitionName'),
    number: readNumber(value['number'], 'number'),
    sourceDraftVersion: readNumber(value['sourceDraftVersion'], 'sourceDraftVersion'),
    definitionDigest: readString(value['definitionDigest'], 'definitionDigest'),
    createdBy: readString(value['createdBy'], 'createdBy'),
    createdAt: readString(value['createdAt'], 'createdAt'),
    created: readBoolean(value['created'], 'created'),
  };
}

export function readDefinitionRelease(value: unknown): DefinitionRelease {
  if (!isObject(value)) throw new TypeError('Definition release response must be an object.');
  return {
    digest: readString(value['digest'], 'digest'),
    managedDefinitionName: readString(value['managedDefinitionName'], 'managedDefinitionName'),
    versionLabel: readString(value['versionLabel'], 'versionLabel'),
    installed: readBoolean(value['installed'], 'installed'),
  };
}

export function readProblemDetail(value: unknown): string | undefined {
  return isObject(value) && typeof value['detail'] === 'string' ? value['detail'] : undefined;
}
