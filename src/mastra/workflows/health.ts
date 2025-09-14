import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

export const healthAssessmentWorkflow = createWorkflow({
  id: 'health-assessment',
  description: 'Triage → assessment → recommendation for user health context',
  inputSchema: z.object({
    prompt: z.string(),
  }),
  outputSchema: z.object({
    summary: z.string(),
  }),
});

const triage = createStep({
  id: 'triage',
  description: 'Check urgency and red flags',
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: z.object({ urgent: z.boolean(), flags: z.array(z.string()) }),
  execute: async ({ tools }) => {
    const { triage } = await tools.readHealthState.execute({ context: {} });
    return { urgent: !!triage?.urgent, flags: (triage?.flags as string[]) ?? [] };
  },
});

const assessment = createStep({
  id: 'assessment',
  description: 'Assess top conditions and unknowns',
  inputSchema: z.object({ prompt: z.string(), urgent: z.boolean() }),
  outputSchema: z.object({
    topConditions: z.array(z.any()),
    unknowns: z.array(z.any()),
  }),
  execute: async ({ tools }) => {
    const top = await tools.readTopConditions.execute({ context: { limit: 5 } });
    const { importantUnknowns } = await tools.readHealthState.execute({ context: {} }) as any;
    return { topConditions: top.items, unknowns: importantUnknowns ?? [] };
  },
});

const recommendation = createStep({
  id: 'recommendation',
  description: 'Provide high-level next steps',
  inputSchema: z.object({ topConditions: z.array(z.any()), unknowns: z.array(z.any()) }),
  outputSchema: z.object({ summary: z.string() }),
  execute: async ({ inputData }) => {
    const top = inputData.topConditions.map((c: any) => c.name || c.id).slice(0, 3).join(', ');
    const unknowns = inputData.unknowns.length;
    const summary = `Likely conditions: ${top || 'N/A'}. Unknowns to clarify: ${unknowns}. Consider ranked actions and follow-up.`;
    return { summary };
  },
});

healthAssessmentWorkflow.then(triage).then(assessment).then(recommendation).commit();


