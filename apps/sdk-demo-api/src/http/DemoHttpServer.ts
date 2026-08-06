import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { TypeScriptDemoApplication } from '../application/TypeScriptDemoApplication.js';
import {
  DemoHttpRequestError,
  readJsonBody,
  readObject,
  readQuestionNames,
} from './DemoHttpRequestReader.js';

export function createDemoHttpServer(application: TypeScriptDemoApplication): Server {
  return createServer((request, response) => {
    void routeRequest(application, request, response).catch((error: unknown) => {
      const status = error instanceof DemoHttpRequestError ? error.status : 500;
      const message = error instanceof Error ? error.message : 'Unexpected server error.';
      writeJson(response, status, { error: message });
    });
  });
}

async function routeRequest(
  application: TypeScriptDemoApplication,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const route = `${request.method ?? 'GET'} ${request.url ?? '/'}`;
  if (route === 'GET /health') {
    writeJson(response, 200, { status: 'healthy', runtime: 'typescript' });
    return;
  }
  if (route === 'GET /api/demo/definition') {
    writeJson(response, 200, application.loadDefinition());
    return;
  }
  const body = readObject(await readJsonBody(request), 'Request body');
  if (route === 'POST /api/demo/definitions/validate') {
    writeJson(response, 200, application.validateDefinition(body['definition']));
    return;
  }
  if (route === 'POST /api/demo/answers/validate') {
    const data = readObject(body['data'], 'data');
    const questionNames = readQuestionNames(body['questionNames']);
    writeJson(response, 200, {
      runtime: 'typescript',
      errors: application.validateAnswers(data, questionNames),
    });
    return;
  }
  if (route === 'POST /api/demo/submissions') {
    const data = readObject(body['data'], 'data');
    writeJson(response, 200, application.submit(body['definition'], data));
    return;
  }
  if (route === 'POST /api/demo/snapshots/round-trip') {
    const data = readObject(body['data'], 'data');
    writeJson(response, 200, application.roundTripSnapshot(body['definition'], data));
    return;
  }
  writeJson(response, 404, { error: 'Route not found.' });
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}
