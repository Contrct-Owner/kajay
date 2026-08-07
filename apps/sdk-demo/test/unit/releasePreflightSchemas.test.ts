import { describe, expect, it } from 'vitest';
import {
  readReleasePreflight,
} from '../../src/features/definition-authoring/api/releasePreflightSchemas.js';

describe('release preflight response schema', () => {
  it('accepts readiness and missing bindings', () => {
    const result = readReleasePreflight({
      digest: 'sha256:release',
      managedDefinitionName: 'onboarding',
      versionLabel: '1.0.0',
      compatible: false,
      missingBindings: ['crm'],
      requiresApproval: true,
    });
    expect(result.missingBindings).toEqual(['crm']);
  });

  it('rejects non-boolean compatibility', () => {
    expect(() => readReleasePreflight({
      digest: 'sha256:release',
      managedDefinitionName: 'onboarding',
      versionLabel: '1.0.0',
      compatible: 'yes',
      missingBindings: [],
      requiresApproval: false,
    })).toThrow(TypeError);
  });
});
