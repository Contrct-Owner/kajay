import assert from 'node:assert/strict';
import test from 'node:test';
import { validateReferenceCoverage } from './validateReferenceCoverage.mjs';

const title = {
  name: 'title',
  type: 'string',
  defaultValue: '',
  isRequired: false,
  isExpression: false,
  isLocalizable: true,
  visibleIf: null,
  readOnlyIf: null,
  description: 'Visible heading.',
};

const titleOccurrence = {
  declaredBy: 'question',
  type: title.type,
  defaultValue: title.defaultValue,
  isRequired: title.isRequired,
  isExpression: title.isExpression,
  isLocalizable: title.isLocalizable,
  visibleIf: title.visibleIf,
  readOnlyIf: title.readOnlyIf,
  description: title.description,
};

function inputs() {
  return {
    metadata: {
      classes: [{
        name: 'question',
        parent: null,
        isAbstract: true,
        declaredProperties: [title],
        declaredChildCollections: [{
          property: 'validators',
          elementBaseType: 'validator',
          shorthandProperty: null,
        }],
      }],
    },
    publicRuntimeSurface: { '@kajay/core': ['parseSurvey'] },
    manifest: {
      definitionTypes: [{
        name: 'question',
        parent: null,
        isAbstract: true,
        description: null,
        gaps: ['description'],
        childCollections: [{
          property: 'validators',
          elementBaseType: 'validator',
          shorthandProperty: null,
          declaredBy: 'question',
        }],
      }],
      definitionProperties: [{
        name: 'title',
        occurrences: [titleOccurrence],
      }],
      apiSymbols: [{
        packageName: '@kajay/core',
        name: 'parseSurvey',
        exportKind: 'value',
        classification: 'consumer',
      }],
    },
  };
}

test('complete source-backed reference coverage passes without fabricated descriptions', () => {
  assert.deepEqual(validateReferenceCoverage(inputs()), []);
});

test('missing facts and fabricated type prose are reported', () => {
  const value = inputs();
  value.manifest.definitionTypes[0].description = 'Invented prose';
  value.manifest.definitionTypes[0].childCollections = [];
  value.manifest.definitionProperties = [];
  value.manifest.apiSymbols[0].classification = 'unclassified';
  const errors = validateReferenceCoverage(value);
  assert.ok(errors.some((error) => error.includes('missing description as a gap')));
  assert.ok(errors.some((error) => error.includes('Child collection')));
  assert.ok(errors.some((error) => error.includes('Definition property')));
  assert.ok(errors.some((error) => error.includes('no audience classification')));
});

test('two reference facts cannot publish the same stable URL', () => {
  const value = inputs();
  value.manifest.apiSymbols.push({
    packageName: '@kajay/core',
    name: 'ParseSurvey',
    exportKind: 'type',
    classification: 'consumer',
    url: '/docs/reference/api/core/parse-survey',
  });
  value.manifest.apiSymbols[0].url = '/docs/reference/api/core/parse-survey';
  const errors = validateReferenceCoverage(value);
  assert.ok(errors.some((error) => error.includes('Reference URL /docs/reference/api/core/parse-survey')));
});
