import Ajv2020 from 'ajv/dist/2020.js';

const JSON_SCHEMA_2020_12 = 'https://json-schema.org/draft/2020-12/schema';
const validator = new Ajv2020({ allErrors: true, strict: true });

/**
 * Validates a schema against the JSON Schema 2020-12 meta-schema.
 *
 * Paths are JSON Pointers into the schema being checked, not into the meta-schema,
 * so a failure points directly at the generated keyword that must be corrected.
 */
export function validateJsonSchema2020(schema) {
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
    return [{ path: '/', reason: 'must be a JSON object' }];
  }
  if (schema.$schema !== JSON_SCHEMA_2020_12) {
    return [
      {
        path: '/$schema',
        reason: `must equal ${JSON.stringify(JSON_SCHEMA_2020_12)}`,
      },
    ];
  }

  let isValid;
  try {
    isValid = validator.validateSchema(schema);
  } catch (error) {
    return [{ path: '/$schema', reason: error instanceof Error ? error.message : String(error) }];
  }
  if (isValid) {
    return [];
  }
  return (validator.errors ?? []).map((error) => ({
    path: error.instancePath.length === 0 ? '/' : error.instancePath,
    reason: error.message ?? 'does not satisfy the JSON Schema 2020-12 meta-schema',
  }));
}
