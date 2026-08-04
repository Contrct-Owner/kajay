import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReferenceManifest } from './buildReferenceManifest.mjs';

const property = {
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

const inputs = {
  metadata: {
    contractVersion: 1,
    definitionSchemaId: 'urn:test',
    definitionSchemaVersion: 1,
    classes: [
      { name: 'pageelement', parent: null, isAbstract: true, declaredProperties: [property], declaredChildCollections: [] },
      { name: 'question', parent: 'pageelement', isAbstract: true, declaredProperties: [], declaredChildCollections: [] },
      { name: 'text', parent: 'question', isAbstract: false, declaredProperties: [], declaredChildCollections: [] },
    ],
  },
  schema: { $id: 'urn:test', $defs: { pageelement: {}, question: {}, text: {} } },
  diagnostics: {
    contractVersion: 1,
    definitionDiagnostics: [{ code: 'bad', severity: 'error', description: 'Bad definition.' }],
    expressionErrors: [],
    dependencyErrors: [],
    surveyErrors: { extensible: true, builtInKinds: [] },
  },
  expressionConformance: { contractVersion: 1 },
  operatorSource: `
    const BINARY_OPERATORS = { and: { spellings: ['and'], printPrecedence: 20, associativity: 'left' } };
    const UNARY_OPERATORS = {};
    const POSTFIX_OPERATORS = {};
  `,
  functionSource: `
    function registerLogicFunctions(registry) { registry.override('iif', () => 1); }
    function registerMathFunctions() {}
    function registerDateFunctions() {}
  `,
  publicInterfaceLedger: '## `@kajay/core` — 0 values',
  packageIndexSources: { '@kajay/core': 'export type { Survey } from "./Survey.js";' },
  publicRuntimeSurface: {},
};

test('manifest inheritance, URLs, and documentation gaps are deterministic', () => {
  const manifest = buildReferenceManifest(inputs);
  const text = manifest.definitionTypes.find(({ name }) => name === 'text');
  assert.deepEqual(text.effectiveProperties, [{ name: 'title', declaredBy: 'pageelement' }]);
  assert.equal(text.category, 'question');
  assert.equal(manifest.definitionProperties[0].url, '/docs/reference/properties/title');
  assert.deepEqual(manifest.expressionFunctions[0].gaps, ['description', 'signature']);
  assert.equal(manifest.apiSymbols[0].classification, 'unclassified');
  assert.deepEqual(buildReferenceManifest(inputs), manifest);
});

test('case-sensitive value and type exports receive distinct stable URLs', () => {
  const collisionInputs = {
    ...inputs,
    publicInterfaceLedger: `
## \`@kajay/core\` — 1 values
| Category | Values | Evidence |
| Consumer operations | \`previewDevice\` | proof |
    `,
    packageIndexSources: {
      '@kajay/core': `
        export { previewDevice } from './previewDevice.js';
        export type { PreviewDevice } from './previewDevice.js';
      `,
    },
    publicRuntimeSurface: { '@kajay/core': ['previewDevice'] },
  };
  const symbols = buildReferenceManifest(collisionInputs).apiSymbols;
  assert.deepEqual(symbols.map(({ name, url }) => [name, url]), [
    ['previewDevice', '/docs/reference/api/core/preview-device'],
    ['PreviewDevice', '/docs/reference/api/core/preview-device-type'],
  ]);
});
