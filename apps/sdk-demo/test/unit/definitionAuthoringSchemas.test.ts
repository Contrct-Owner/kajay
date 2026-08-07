import { describe, expect, it } from 'vitest';
import {
  readDefinitionDraft,
  readDefinitionRelease,
  readDefinitionRevision,
} from '../../src/features/definition-authoring/api/definitionAuthoringSchemas.js';

describe('definition authoring response schemas', () => {
  it('accepts the host draft, revision, and release contracts', () => {
    const draft = readDefinitionDraft({
      managedDefinitionName: 'onboarding',
      definition: { pages: [] },
      definitionDigest: 'sha256:digest',
      version: 2,
      updatedBy: 'author',
      updatedAt: '2026-08-06T00:00:00Z',
      created: false,
    });
    const revision = readDefinitionRevision({
      managedDefinitionName: 'onboarding',
      number: 1,
      sourceDraftVersion: 2,
      definitionDigest: 'sha256:digest',
      createdBy: 'author',
      createdAt: '2026-08-06T00:00:00Z',
      created: true,
    });
    const release = readDefinitionRelease({
      digest: 'sha256:release',
      managedDefinitionName: 'onboarding',
      versionLabel: '1.0.0',
      installed: true,
    });

    expect(draft.version).toBe(2);
    expect(revision.sourceDraftVersion).toBe(2);
    expect(release.installed).toBe(true);
  });

  it('rejects malformed external payloads', () => {
    expect(() => readDefinitionDraft({ version: '2' })).toThrow(TypeError);
    expect(() => readDefinitionRevision({ number: -1 })).toThrow(TypeError);
    expect(() => readDefinitionRelease({ installed: 'yes' })).toThrow(TypeError);
  });
});
