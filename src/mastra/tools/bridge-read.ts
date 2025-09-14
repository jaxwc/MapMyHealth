import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import AgentBridge from '@/app/agent/AgentBridge';

export const readHealthState = createTool({
  id: 'readHealthState',
  description: 'Returns a summarized health state for grounding.',
  inputSchema: z.object({}).optional(),
  outputSchema: z.object({
    knownFindings: z.any().optional(),
    triage: z.any().optional(),
    rankedConditions: z.any(),
    importantUnknowns: z.any(),
    actionRanking: z.any().optional(),
    lastEvaluatedAt: z.string().optional(),
  }),
  execute: async () => {
    const state = AgentBridge.readHealthState();
    return {
      knownFindings: state.knownFindings,
      triage: state.triage,
      rankedConditions: state.rankedConditions,
      importantUnknowns: state.importantUnknowns,
      actionRanking: state.actionRanking,
      lastEvaluatedAt: state.lastEvaluatedAt,
    };
  },
});

export const readKnownFindings = createTool({
  id: 'readKnownFindings',
  description: 'Returns the current list of known findings (ids and values) for selective removal or updates.',
  inputSchema: z.object({}).optional(),
  outputSchema: z.object({
    findings: z.array(z.object({
      id: z.string(),
      presence: z.string().optional(),
      value: z.any().optional(),
      daysSinceOnset: z.number().optional(),
      severity: z.string().optional(),
    })),
  }),
  execute: async () => {
    const state = AgentBridge.readHealthState();
    const findings = (state.knownFindings ?? []).map((f: any) => ({
      id: f.id,
      presence: f.presence,
      value: f.value,
      daysSinceOnset: f.daysSinceOnset,
      severity: f.severity,
    }));
    return { findings };
  },
});

export const readTopConditions = createTool({
  id: 'readTopConditions',
  description: 'Returns top-N ranked medical conditions based on the patient\'s current state.',
  inputSchema: z.object({ limit: z.number().optional() }).optional(),
  outputSchema: z.object({
    items: z.array(z.any()),
  }),
  execute: async ({ context }) => {
    const limit = context?.limit ?? 5;
    const items = AgentBridge.readTopConditions(limit);
    return { items };
  },
});

export const readActionRanking = createTool({
  id: 'readActionRanking',
  description: 'Returns the ranked list of recommended health actions to take.',
  inputSchema: z.object({}).optional(),
  outputSchema: z.object({ items: z.array(z.any()) }),
  execute: async () => ({ items: AgentBridge.readActionRanking() }),
});

export const readActionMap = createTool({
  id: 'readActionMap',
  description: 'Returns a map of health actions and their outcomes, that can be used to visualize and plan the next steps in the health journey.',
  inputSchema: z.object({}).optional(),
  outputSchema: z.object({ map: z.any() }),
  execute: async () => ({ map: AgentBridge.readActionMap() }),
});

export const renderActionMap = createTool({
  id: 'renderActionMap',
  description: 'Requests the UI to render the current action map from HealthState (no custom mermaid).',
  inputSchema: z.object({}).optional(),
  outputSchema: z.object({ ui: z.literal('action-map') }),
  execute: async () => ({ ui: 'action-map' as const }),
});

export const readConditionInformation = createTool({
  id: 'readConditionInformation',
  description: 'Returns detailed info, symptoms, and relationships for a condition.',
  inputSchema: z.object({ conditionId: z.string() }),
  outputSchema: z.object({ info: z.any().nullable() }),
  execute: async ({ context }) => {
    const info = await AgentBridge.readConditionInformation(context.conditionId);
    return { info };
  },
});

export const bridgeReadTools = {
  readHealthState,
  readKnownFindings,
  readTopConditions,
  readActionRanking,
  readActionMap,
  readConditionInformation,
  renderActionMap,
};


