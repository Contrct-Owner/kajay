import { createFileRoute } from '@tanstack/react-router';
import { handleDocsMcpRequest } from '@/features/docs-mcp';

export const Route = createFileRoute('/mcp')({
  server: {
    handlers: {
      POST: ({ request }) => handleDocsMcpRequest(request),
      GET: ({ request }) => handleDocsMcpRequest(request),
      DELETE: ({ request }) => handleDocsMcpRequest(request),
    },
  },
});
