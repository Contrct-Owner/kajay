import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import {
  createDocsIndexMarkdown,
  createReferenceManifestJson,
  searchKajayDocs,
} from './docsMcpCatalog';

const DOCS_INDEX_URI = 'kajay://docs/index';
const REFERENCE_MANIFEST_URI = 'kajay://docs/reference-manifest';

function registerDocsIndex(server: McpServer): void {
  server.registerResource(
    'kajay-docs-index',
    DOCS_INDEX_URI,
    {
      title: 'Kajay documentation index',
      description: 'Authored Kajay guides and their canonical browser URLs.',
      mimeType: 'text/markdown',
    },
    () => ({
      contents: [{
        uri: DOCS_INDEX_URI,
        mimeType: 'text/markdown',
        text: createDocsIndexMarkdown(),
      }],
    }),
  );
}

function registerReferenceManifest(server: McpServer): void {
  server.registerResource(
    'kajay-reference-manifest',
    REFERENCE_MANIFEST_URI,
    {
      title: 'Kajay generated reference manifest',
      description: 'Definition, diagnostic, expression, and public API reference facts.',
      mimeType: 'application/json',
    },
    () => ({
      contents: [{
        uri: REFERENCE_MANIFEST_URI,
        mimeType: 'application/json',
        text: createReferenceManifestJson(),
      }],
    }),
  );
}

function registerSearchTool(server: McpServer): void {
  server.registerTool(
    'search_kajay_docs',
    {
      title: 'Search Kajay documentation',
      description: 'Search authored guides and generated Kajay reference facts.',
      inputSchema: {
        query: z.string().trim().min(1).max(200).describe('Words or symbols to find.'),
        limit: z.number().int().min(1).max(20).default(10).describe('Maximum results.'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    ({ query, limit }) => {
      const results = searchKajayDocs(query, limit);
      return {
        content: [{ type: 'text', text: JSON.stringify({ results }, undefined, 2) }],
        structuredContent: { results },
      };
    },
  );
}

export function createDocsMcpServer(): McpServer {
  const server = new McpServer(
    { name: 'kajay-docs', version: '0.0.0' },
    {
      instructions: 'Search and read Kajay consumer documentation. This server is read-only.',
    },
  );

  registerDocsIndex(server);
  registerReferenceManifest(server);
  registerSearchTool(server);
  return server;
}
