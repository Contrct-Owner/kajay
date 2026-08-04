import assert from 'node:assert/strict';
import test from 'node:test';
import { validateJsonSchema2020 } from '../lib/jsonSchema2020.mjs';

const DIALECT = 'https://json-schema.org/draft/2020-12/schema';

test('accepts a valid JSON Schema 2020-12 document', () => {
  assert.deepEqual(
    validateJsonSchema2020({
      $schema: DIALECT,
      type: 'object',
      properties: { name: { type: 'string' } },
    }),
    [],
  );
});

test('reports the schema path and reason for an invalid keyword value', () => {
  const failures = validateJsonSchema2020({
    $schema: DIALECT,
    type: 'not-a-json-schema-type',
  });

  assert.ok(failures.length > 0);
  assert.ok(failures.some((failure) => failure.path === '/type'));
  assert.ok(failures.every((failure) => failure.reason.length > 0));
});

test('rejects a schema that names the wrong dialect at the precise path', () => {
  assert.deepEqual(validateJsonSchema2020({ $schema: 'https://json-schema.org/draft-07/schema#' }), [
    {
      path: '/$schema',
      reason: `must equal ${JSON.stringify(DIALECT)}`,
    },
  ]);
});
