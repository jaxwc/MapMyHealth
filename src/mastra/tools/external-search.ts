import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// Simple placeholder search tool. In production, wire a real search provider API.
export const externalSearchTool = createTool({
  id: 'externalSearch',
  description: 'Searches the web for reputable sources to augment health info.',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    allowDomains: z.array(z.string()).optional().describe('Optional allowlist of domains'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string(),
      source: z.string().optional(),
    })),
    note: z.string().optional(),
  }),
  execute: async ({ context }) => {
    // Not configured: return a helpful message so the agent can continue gracefully.
    return {
      results: [],
      note: 'externalSearch is not configured with a provider. Configure a search API to enable results.',
    };
  },
});


