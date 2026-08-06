import { readFile } from 'node:fs/promises';
import type { SurveyDefinition } from '@kajay/core';
import { TypeScriptDemoApplication } from './application/TypeScriptDemoApplication.js';
import { createDemoHttpServer } from './http/DemoHttpServer.js';

const definitionUrl = new URL('../../sdk-demo/public/demo-survey.json', import.meta.url);
const definition = JSON.parse(await readFile(definitionUrl, 'utf8')) as SurveyDefinition;
const application = new TypeScriptDemoApplication(definition);
const port = readPort(process.env['PORT']);

createDemoHttpServer(application).listen(port, '0.0.0.0', () => {
  process.stdout.write(`Kajay TypeScript demo API listening on ${port}.\n`);
});

function readPort(configured: string | undefined): number {
  if (configured === undefined) return 8080;
  const parsedPort = Number(configured);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
    throw new RangeError('PORT must be an integer from 1 through 65535.');
  }
  return parsedPort;
}
