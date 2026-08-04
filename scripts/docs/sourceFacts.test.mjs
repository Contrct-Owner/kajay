import assert from 'node:assert/strict';
import test from 'node:test';
import {
  expressionFunctions,
  expressionOperators,
  packageExports,
  runtimeClassifications,
} from './sourceFacts.mjs';

test('expression syntax facts come from the exhaustive operator records', () => {
  const source = `
    const BINARY_OPERATORS = { and: { spellings: ['and', '&&'], printPrecedence: 20, associativity: 'left' } };
    const UNARY_OPERATORS = { not: { spellings: ['not', '!'], printPrecedence: 55 } };
    const POSTFIX_OPERATORS = { empty: { spellings: ['empty'], printPrecedence: 70 } };
  `;
  assert.deepEqual(expressionOperators(source), [
    { name: 'and', kind: 'binary', spellings: ['and', '&&'], precedence: 20, associativity: 'left' },
    { name: 'not', kind: 'unary', spellings: ['not', '!'], precedence: 55, associativity: null },
    { name: 'empty', kind: 'postfix', spellings: ['empty'], precedence: 70, associativity: null },
  ]);
});

test('built-in functions keep their authoritative category', () => {
  const source = `
    function registerLogicFunctions(registry) { registry.override('iif', () => 1); }
    function registerMathFunctions(registry) { registry.override('sum', () => 1); }
    function registerDateFunctions(registry) { registry.override('today', () => 1); }
    function unrelated(registry) { registry.override('hostOnly', () => 1); }
  `;
  assert.deepEqual(expressionFunctions(source), [
    { name: 'iif', category: 'logic' },
    { name: 'sum', category: 'math' },
    { name: 'today', category: 'date' },
  ]);
});

test('package exports include re-exports and declarations with runtime identity', () => {
  const source = `
    export { parseSurvey } from './parseSurvey.js';
    export type { Survey } from './Survey.js';
    export interface Theme { readonly name: string; }
    export function themeVariables() {}
    export const themes = [];
  `;
  assert.deepEqual(packageExports(source), [
    { name: 'parseSurvey', exportKind: 'value' },
    { name: 'Survey', exportKind: 'type' },
    { name: 'Theme', exportKind: 'type' },
    { name: 'themeVariables', exportKind: 'value' },
    { name: 'themes', exportKind: 'value' },
  ]);
});

test('ledger categories preserve consumer, extension, and adapter audiences', () => {
  const markdown = `
## \`@kajay/core\` — 3 values
| Category | Values | Evidence |
| Consumer operations | \`parseSurvey\` | proof |
| Intentional extension seams | \`MetadataRegistry\` | proof |
| Maintained adapter requirements | \`evaluateExpression\` | proof |
  `;
  assert.deepEqual([...runtimeClassifications(markdown)], [
    ['@kajay/core:parseSurvey', 'consumer'],
    ['@kajay/core:MetadataRegistry', 'extension'],
    ['@kajay/core:evaluateExpression', 'adapter'],
  ]);
});
