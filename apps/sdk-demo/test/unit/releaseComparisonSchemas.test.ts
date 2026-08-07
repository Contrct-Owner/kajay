import { describe, expect, it } from 'vitest';
import {
  readReleaseComparison,
} from '../../src/features/definition-authoring/api/releaseComparisonSchemas.js';

describe('release comparison response schema', () => {
  it('accepts a consistent semantic change review', () => {
    const result = readReleaseComparison(comparisonResponse());
    expect(result.baseline?.versionLabel).toBe('1.0.0');
    expect(result.summary.changed).toBe(1);
    expect(result.changes[0]?.area).toBe('definition');
  });

  it('accepts an initial release without a baseline', () => {
    const result = readReleaseComparison({
      ...comparisonResponse(), baseline: null, initialRelease: true,
      summary: { added: 0, removed: 0, changed: 0, total: 0 }, changes: [],
    });
    expect(result.baseline).toBeUndefined();
    expect(result.initialRelease).toBe(true);
  });

  it('rejects inconsistent summary, baseline, and change values', () => {
    expect(() => readReleaseComparison({
      ...comparisonResponse(), summary: { added: 1, removed: 0, changed: 0, total: 2 },
    })).toThrow(TypeError);
    expect(() => readReleaseComparison({
      ...comparisonResponse(), baseline: null,
    })).toThrow(TypeError);
    expect(() => readReleaseComparison({
      ...comparisonResponse(),
      changes: [{ ...changeResponse(), kind: 'added', beforeValue: 'old' }],
    })).toThrow(TypeError);
  });
});

function comparisonResponse(): object {
  return {
    environmentName: 'test',
    baseline: { digest: 'sha256:first', versionLabel: '1.0.0' },
    target: { digest: 'sha256:second', versionLabel: '2.0.0' },
    initialRelease: false,
    summary: { added: 0, removed: 0, changed: 1, total: 1 },
    changes: [changeResponse()],
    truncated: false,
  };
}

function changeResponse(): object {
  return {
    kind: 'changed',
    area: 'definition',
    path: '$.workflow.steps[key="survey"].definition.title',
    beforeValue: '"First"',
    afterValue: '"Second"',
  };
}
