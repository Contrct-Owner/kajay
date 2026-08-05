import { describe, expect, test } from 'vitest';
import {
  createDocsIndexMarkdown,
  handleDocsMcpRequest,
  searchKajayDocs,
} from '../../src/features/docs-mcp/index.js';

interface JsonRpcResponse {
  readonly id?: number | null;
  readonly result?: Record<string, unknown>;
  readonly error?: { readonly code: number; readonly message: string };
}

async function callMcp(
  method: string,
  params: Record<string, unknown> = {},
): Promise<JsonRpcResponse> {
  const response = await handleDocsMcpRequest(new Request('https://kajay.io/mcp', {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': '2025-11-25',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }));
  expect(response.status).toBe(200);
  return response.json() as Promise<JsonRpcResponse>;
}

describe('Kajay documentation MCP catalog', () => {
  test('searches authored and generated documentation with canonical URLs', () => {
    expect(searchKajayDocs('model context protocol', 10)).toContainEqual(
      expect.objectContaining({
        kind: 'guide',
        title: 'Use Kajay docs over MCP',
        url: 'https://kajay.io/docs/integration/model-context-protocol',
      }),
    );
    expect(searchKajayDocs('parseSurvey', 1)[0]).toMatchObject({
      kind: 'api-symbol',
      url: 'https://kajay.io/docs/reference/api/core/parse-survey',
    });
  });

  test('builds a readable catalog from the generated authored manifest', () => {
    const index = createDocsIndexMarkdown();
    expect(index).toContain('# Kajay documentation');
    expect(index).toContain('[Expressions and conditional logic]');
    expect(index).toContain('kajay://docs/reference-manifest');
  });
});

describe('Kajay documentation MCP transport', () => {
  test('negotiates the protocol and advertises only read-only documentation capabilities', async () => {
    const initialized = await callMcp('initialize', {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'kajay-test', version: '1.0.0' },
    });
    expect(initialized.error).toBeUndefined();
    expect(initialized.result).toMatchObject({
      protocolVersion: '2025-11-25',
      serverInfo: { name: 'kajay-docs', version: '0.0.0' },
      capabilities: { resources: {}, tools: {} },
    });

    const tools = await callMcp('tools/list');
    expect(tools.result).toMatchObject({
      tools: [{
        name: 'search_kajay_docs',
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      }],
    });
  });

  test('lists, reads, and searches the documented MCP surface', async () => {
    const resources = await callMcp('resources/list');
    expect(resources.result).toMatchObject({
      resources: [
        { uri: 'kajay://docs/index', mimeType: 'text/markdown' },
        { uri: 'kajay://docs/reference-manifest', mimeType: 'application/json' },
      ],
    });

    const read = await callMcp('resources/read', { uri: 'kajay://docs/index' });
    expect(read.result).toMatchObject({
      contents: [{ uri: 'kajay://docs/index', mimeType: 'text/markdown' }],
    });
    expect(JSON.stringify(read.result)).toContain('Kajay documentation');

    const search = await callMcp('tools/call', {
      name: 'search_kajay_docs',
      arguments: { query: 'visibleIf', limit: 3 },
    });
    expect(search.error).toBeUndefined();
    expect(JSON.stringify(search.result)).toContain('https://kajay.io/docs/');
  });

  test('rejects unsupported methods and cross-origin browser requests', async () => {
    const get = await handleDocsMcpRequest(new Request('https://kajay.io/mcp'));
    expect(get.status).toBe(405);
    expect(get.headers.get('Allow')).toBe('POST');

    const crossOrigin = await handleDocsMcpRequest(new Request('https://kajay.io/mcp', {
      method: 'POST',
      headers: { Origin: 'https://example.com' },
    }));
    expect(crossOrigin.status).toBe(403);
  });

  test('reports invalid search input as a tool error', async () => {
    const invalid = await callMcp('tools/call', {
      name: 'search_kajay_docs',
      arguments: { query: '', limit: 100 },
    });
    expect(invalid.error).toBeUndefined();
    expect(invalid.result).toMatchObject({ isError: true });
    expect(JSON.stringify(invalid.result)).toContain('Input validation error');
  });
});
