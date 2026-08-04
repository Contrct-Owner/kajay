#!/usr/bin/env node
/** Package-owned access to contract generators that are not part of the npm interface. */
import { generateContract } from '../dist/contract/generateContract.js';
import { generateDiagnosticContract } from '../dist/contract/generateDiagnosticContract.js';
import { generateMetadataContract } from '../dist/contract/generateMetadataContract.js';

process.stdout.write(JSON.stringify({
  schema: generateContract(),
  metadata: generateMetadataContract(),
  diagnostics: generateDiagnosticContract(),
}));
