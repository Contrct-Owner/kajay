import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createDocsMcpServer } from './createDocsMcpServer';

function methodNotAllowed(): Response {
  return Response.json(
    {
      jsonrpc: '2.0',
      error: { code: -32_000, message: 'Method not allowed.' },
      id: null,
    },
    { status: 405, headers: { Allow: 'POST' } },
  );
}

function forbiddenOrigin(): Response {
  return Response.json(
    {
      jsonrpc: '2.0',
      error: { code: -32_000, message: 'Origin is not allowed.' },
      id: null,
    },
    { status: 403 },
  );
}

function hasAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (origin === null) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function handleDocsMcpRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed();
  if (!hasAllowedOrigin(request)) return forbiddenOrigin();

  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });
  const server = createDocsMcpServer();
  await server.connect(transport);
  return transport.handleRequest(request);
}
