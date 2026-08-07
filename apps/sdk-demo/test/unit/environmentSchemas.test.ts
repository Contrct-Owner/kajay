import { describe, expect, it } from 'vitest';
import {
  readBindings,
  readEnvironments,
} from '../../src/features/definition-authoring/api/environmentSchemas.js';

describe('environment response schemas', () => {
  it('accepts catalog and write-only binding metadata', () => {
    const environments = readEnvironments([environmentResponse()]);
    const bindings = readBindings([bindingResponse()]);
    expect(environments[0]?.requiresApproval).toBe(true);
    expect(bindings[0]?.version).toBe(1);
    expect(bindings[0]).not.toHaveProperty('reference');
  });

  it('rejects malformed versions', () => {
    expect(() => readEnvironments([{ ...environmentResponse(), version: -1 }]))
      .toThrow(TypeError);
    expect(() => readBindings([{ ...bindingResponse(), version: '1' }]))
      .toThrow(TypeError);
  });
});

function environmentResponse(): object {
  return {
    name: 'production', displayName: 'Production', requiresApproval: true,
    position: 400, version: 1, createdBy: 'manager', updatedBy: 'manager',
    createdAt: '2026-08-07T00:00:00Z', updatedAt: '2026-08-07T00:00:00Z',
  };
}

function bindingResponse(): object {
  return {
    environmentName: 'production', name: 'crm', version: 1, updatedBy: 'manager',
    updatedAt: '2026-08-07T00:00:00Z',
  };
}
