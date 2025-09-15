import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import AgentBridge from '@/app/agent/AgentBridge';

async function resolveOutcomeId(actionId: string, raw: string): Promise<string | null> {
  const outcomes = AgentBridge.getActionOutcomes(actionId);
  if (!outcomes || !Array.isArray(outcomes.outcomes)) return null;
  const list = outcomes.outcomes;
  const want = String(raw || '').toLowerCase().trim();

  // Exact id or label match
  const exactId = list.find(o => (o.outcomeId || '').toLowerCase() === want)?.outcomeId;
  if (exactId) return exactId;
  const exactLabel = list.find(o => (o.label || '').toLowerCase() === want)?.outcomeId;
  if (exactLabel) return exactLabel;

  // Substring mapping for common synonyms
  const contains = (substr: string) =>
    list.find(o => (o.outcomeId || '').toLowerCase().includes(substr) || (o.label || '').toLowerCase().includes(substr))?.outcomeId || null;

  if (want === 'positive' || want === 'pos' || want === '+') {
    return contains('positive') || contains('pos') || list[0]?.outcomeId || null;
  }
  if (want === 'negative' || want === 'neg' || want === '-') {
    return contains('negative') || contains('neg') || list[1]?.outcomeId || null;
  }

  // Try generic label fragments
  return contains(want);
}

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
    // Resolve provided id or label to a canonical finding id
    try {
      const symptoms = await AgentBridge.listSymptoms();
      const byId = new Map<string, string>();
      const byLabel = new Map<string, string>();
      for (const s of symptoms) {
        byId.set(s.id.toLowerCase(), s.id);
        byLabel.set(s.label.toLowerCase(), s.id);
      }

      const raw = String(context.id || '').trim();
      const resolvedId =
        byId.get(raw) ||
        byId.get(raw.toLowerCase()) ||
        byLabel.get(raw.toLowerCase());

      if (!resolvedId) {
        console.warn('[addFindingTool] Unknown finding id/label:', raw);
        return { success: false };
      }

      await AgentBridge.addFinding({
        id: resolvedId,
        presence: context.presence,
        value: context.value,
        daysSinceOnset: context.daysSinceOnset,
        severity: context.severity,
        source: 'agent',
      } as any);
      return { success: true };
    } catch (err) {
      console.error('[addFindingTool] Failed to add finding:', err);
      return { success: false };
    }
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
    try {
      const outcomes = AgentBridge.getActionOutcomes(context.actionId);
      let chosen = context.outcomeId;

      // Try exact id match first
      if (!outcomes || !outcomes.outcomes?.some(o => o.outcomeId === chosen)) {
        const guess = String(context.outcomeId || '').toLowerCase();
        const list = outcomes?.outcomes || [];
        // Map common synonyms ("positive"/"negative")
        const byContains = (substr: string) => list.find(o => (o.outcomeId || '').toLowerCase().includes(substr) || (o.label || '').toLowerCase().includes(substr));
        const byExactLabel = list.find(o => (o.label || '').toLowerCase() === guess);
        const byExactId = list.find(o => (o.outcomeId || '').toLowerCase() === guess);

        const mapped =
          byExactId?.outcomeId ||
          byExactLabel?.outcomeId ||
          (guess === 'positive' ? byContains('positive')?.outcomeId : undefined) ||
          (guess === 'negative' ? byContains('negative')?.outcomeId : undefined);

        if (mapped) {
          chosen = mapped;
        } else if (list.length === 2 && (guess === 'pos' || guess === '+' || guess === 'neg' || guess === '-')) {
          // Heuristic for binary tests
          chosen = (guess === 'pos' || guess === '+') ? list.find(o => /pos(itive)?/i.test(o.outcomeId) || /pos(itive)?/i.test(o.label))?.outcomeId || list[0].outcomeId :
                   list.find(o => /neg(ative)?/i.test(o.outcomeId) || /neg(ative)?/i.test(o.label))?.outcomeId || list[1].outcomeId;
        }
      }

      await AgentBridge.applyActionOutcome(context.actionId, chosen);
      return { success: true };
    } catch (err) {
      console.error('[applyActionOutcomeTool] Failed to apply outcome:', err);
      return { success: false };
    }
  },
});

export const takeActionTool = createTool({
  id: 'takeAction',
  description: 'Takes an action by applying an outcome and syncing state via the server mutate endpoint (mirrors UI).',
  inputSchema: z.object({ actionId: z.string(), outcomeId: z.string() }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ context }) => {
    try {
      const chosen = (await resolveOutcomeId(context.actionId, context.outcomeId)) ?? context.outcomeId;
      await AgentBridge.takeAction(context.actionId, chosen);
      return { success: true };
    } catch (err) {
      console.error('[takeActionTool] Failed to take action:', err);
      return { success: false };
    }
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
  takeAction: takeActionTool,
  updatePatientData: updatePatientDataTool,
};


