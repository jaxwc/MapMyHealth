import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import AgentBridge from '@/app/agent/AgentBridge';

export const addFindingTool = createTool({
  id: 'addFinding',
  description: 'Adds or updates a known finding in the health state.',
  inputSchema: z.object({
    id: z.string(),
    presence: z.enum(['present', 'absent']),
    value: z.any().optional(),
    daysSinceOnset: z.number().optional(),
    severity: z.string().optional(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ context }) => {
    await AgentBridge.addFinding({
      id: context.id,
      presence: context.presence,
      value: context.value,
      daysSinceOnset: context.daysSinceOnset,
      severity: context.severity,
      source: 'agent',
    } as any);
    return { success: true };
  },
});

export const removeFindingTool = createTool({
  id: 'removeFinding',
  description: 'Removes a known finding by ID.',
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ context }) => {
    await AgentBridge.removeFinding(context.id);
    return { success: true };
  },
});

export const applyActionOutcomeTool = createTool({
  id: 'applyActionOutcome',
  description: 'Applies a selected outcome for an action.',
  inputSchema: z.object({ actionId: z.string(), outcomeId: z.string() }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ context }) => {
    await AgentBridge.applyActionOutcome(context.actionId, context.outcomeId);
    return { success: true };
  },
});

export const updatePatientDataTool = createTool({
  id: 'updatePatientData',
  description: 'Updates patient demographics/history in the store.',
  inputSchema: z.object({ patientData: z.any() }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ context }) => {
    await AgentBridge.updatePatientData(context.patientData);
    return { success: true };
  },
});

export const bridgeWriteTools = {
  addFinding: addFindingTool,
  removeFinding: removeFindingTool,
  applyActionOutcome: applyActionOutcomeTool,
  updatePatientData: updatePatientDataTool,
};


