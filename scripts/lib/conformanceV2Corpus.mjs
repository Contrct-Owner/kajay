import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

const SCHEMA_ID = 'https://kajay.io/conformance/v2/corpus.schema.json';
const SUITES = [
  ['manifest.json', 'manifest', []],
  ['definitions.json', 'definitionsSuite', ['cases']],
  ['expressions.json', 'expressionsSuite', ['parsing', 'evaluation']],
  ['scenarios.json', 'scenariosSuite', ['scenarios']],
];

export function validateConformanceV2(repositoryRoot) {
  const directory = resolve(repositoryRoot, 'conformance/v2');
  const schema = readJson(resolve(directory, 'corpus.schema.json'));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addSchema(schema);
  const failures = [];
  let caseCount = 0;

  for (const [file, definition, sections] of SUITES) {
    const document = readJson(resolve(directory, file));
    const validate = ajv.getSchema(`${SCHEMA_ID}#/$defs/${definition}`);
    if (validate === undefined || !validate(document)) {
      failures.push(...formatErrors(file, validate?.errors ?? []));
    }
    for (const section of sections) {
      const ids = document[section].map(({ id }) => id);
      caseCount += ids.length;
      if (new Set(ids).size !== ids.length) failures.push(`${file}/${section}: duplicate id`);
    }
  }
  return { failures, caseCount };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function formatErrors(file, errors) {
  return errors.map(({ instancePath, message }) => `${file}${instancePath}: ${message}`);
}
