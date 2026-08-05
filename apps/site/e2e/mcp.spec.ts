import { expect, test } from '@playwright/test';

const mcpHeaders = {
  Accept: 'application/json, text/event-stream',
  'Content-Type': 'application/json',
  'MCP-Protocol-Version': '2025-11-25',
};

test('the deployed site exposes the documented read-only MCP contract', async ({ request }) => {
  const initialize = await request.post('/mcp', {
    headers: mcpHeaders,
    data: {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'kajay-e2e', version: '1.0.0' },
      },
    },
  });
  expect(initialize.status()).toBe(200);
  await expect(initialize.json()).resolves.toMatchObject({
    result: {
      serverInfo: { name: 'kajay-docs', version: '0.0.0' },
      capabilities: { resources: {}, tools: {} },
    },
  });

  const tools = await request.post('/mcp', {
    headers: mcpHeaders,
    data: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
  });
  await expect(tools.json()).resolves.toMatchObject({
    result: {
      tools: [{ name: 'search_kajay_docs', annotations: { readOnlyHint: true } }],
    },
  });

  const search = await request.post('/mcp', {
    headers: mcpHeaders,
    data: {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'search_kajay_docs',
        arguments: { query: 'parseSurvey', limit: 5 },
      },
    },
  });
  expect(JSON.stringify((await search.json()) as unknown)).toContain(
    'https://kajay.io/docs/reference/api/core/parse-survey',
  );

  const get = await request.get('/mcp');
  expect(get.status()).toBe(405);
  expect(get.headers()['allow']).toBe('POST');
});
