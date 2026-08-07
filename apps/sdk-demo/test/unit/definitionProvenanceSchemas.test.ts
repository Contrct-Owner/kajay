import { describe, expect, it } from 'vitest';
import {
  readDefinitionProvenance,
} from '../../src/features/definition-authoring/api/definitionProvenanceSchemas.js';

describe('definition provenance response schema', () => {
  it('accepts activation, revision, release, and audit history', () => {
    const result = readDefinitionProvenance(provenanceResponse());
    expect(result.activation.versionLabel).toBe('2.0.0');
    expect(result.revisions[0]?.releaseDigests).toEqual(['sha256:release']);
    expect(result.releases[0]?.promotionStatus).toBe('active');
    expect(result.auditEvents[0]?.actorId).toBe('release-manager');
  });

  it('rejects invalid promotion and activation state', () => {
    expect(() => readDefinitionProvenance({
      ...provenanceResponse(),
      activation: { version: -1 },
    })).toThrow(TypeError);
    expect(() => readDefinitionProvenance({
      ...provenanceResponse(),
      releases: [{ ...releaseResponse(), promotionStatus: 'unknown' }],
    })).toThrow(TypeError);
  });
});

function provenanceResponse(): object {
  return {
    managedDefinitionName: 'onboarding',
    createdBy: 'author',
    createdAt: '2026-08-06T00:00:00Z',
    environmentName: 'test',
    environments: ['test'],
    activation: {
      version: 2,
      releaseDigest: 'sha256:release',
      versionLabel: '2.0.0',
      activatedBy: 'release-manager',
      approvedBy: null,
      activatedAt: '2026-08-06T01:00:00Z',
    },
    revisions: [{
      number: 1,
      sourceDraftVersion: 1,
      definitionDigest: 'sha256:definition',
      createdBy: 'author',
      createdAt: '2026-08-06T00:10:00Z',
      releaseDigests: ['sha256:release'],
    }],
    releases: [releaseResponse()],
    auditEvents: [{
      id: '0198f55b-b729-72f8-a4a8-130af0310f2f',
      subject: 'test/onboarding',
      eventType: 'definition-release-activated',
      payload: { releaseDigest: 'sha256:release', version: 2 },
      actorId: 'release-manager',
      occurredAt: '2026-08-06T01:00:00Z',
    }],
  };
}

function releaseResponse(): object {
  return {
    digest: 'sha256:release',
    versionLabel: '2.0.0',
    conformanceVersion: 1,
    installedAt: '2026-08-06T00:20:00Z',
    sourceRevisionNumbers: [1],
    requiredBindings: [],
    missingBindings: [],
    promotionStatus: 'active',
    canActivate: false,
    canRollback: false,
  };
}
