/**
 * MapMyHealth Agent Bridge
 *
 * Skeleton implementation providing clean API for AI agent interactions.
 * Maps agent capabilities to store actions and engine facade.
 */

import { useHealthStore } from '../state/healthStore';
import { createEngineFacade } from '../../engine/facade';
import type {
  HealthState,
  KnownFinding,
  TreatmentRecommendation,
  RankedCondition,
  ActionRankingItem
} from '../types/health';

/**
 * Agent Bridge API
 * Provides read-only and mutation capabilities for AI agents
 */
export const Agent = {
  /**
   * READ OPERATIONS
   * Get current health state and related information
   */

  /**
   * Returns a read-only snapshot of the entire health state.
   * Use this to ground the agent with current context before planning or explaining.
   * @returns HealthState
   */
  readHealthState: (): HealthState => {
    return useHealthStore.getState();
  },

  /**
   * Fetches detailed information and relationships for a given condition.
   * Use this when the agent needs deeper context: related findings/actions and a concise summary.
   * @param conditionId - ID of the condition to inspect
   * @returns structured condition info or null on failure
   */
  readConditionInformation: async (conditionId: string) => {
    const engine = await createEngineFacade();
    try {
      const conditionGraph = await engine.getConditionGraph(conditionId);
      return {
        condition: conditionGraph.condition,
        relatedFindings: conditionGraph.relatedFindings,
        relatedActions: conditionGraph.relatedActions,
        // Simplified view for agent consumption
        summary: {
          id: conditionGraph.condition.id,
          label: conditionGraph.condition.label,
          description: conditionGraph.condition.description,
          priors: conditionGraph.condition.priors,
          probabilityBands: conditionGraph.condition.probabilityBands,
          evidenceCount: conditionGraph.condition.lrTable.length,
          relatedFindingIds: conditionGraph.relatedFindings.map((f: any) => f.id),
          relatedActionIds: conditionGraph.relatedActions.map((a: any) => a.id)
        }
      };
    } catch (error) {
      console.error(`Error reading condition information for ${conditionId}:`, error);
      return null;
    }
  },

  /**
   * Returns the current prioritized list of actions the user can take.
   * Use this to propose next steps; the list is already scored by the engine.
   * @returns ranked action items
   */
  readActionRanking: (): ActionRankingItem[] => {
    const state = useHealthStore.getState();
    return state.actionRanking || [];
  },

  /**
   * Returns a map of available actions keyed by action ID.
   * Use this for quick lookups or to resolve metadata for actions in the ranking.
   */
  readActionMap: () => {
    const state = useHealthStore.getState();
    return state.actionMap;
  },

  /**
   * Returns the list of valid symptom finding IDs and labels from the content pack.
   * Use this to constrain agent inputs when adding findings.
   */
  listSymptoms: async (): Promise<Array<{ id: string; label: string }>> => {
    const engine = await createEngineFacade();
    const content = engine.getContentPack();
    return content.findings
      .filter((f: any) => f.kind === 'symptom')
      .map((f: any) => ({ id: f.id, label: f.label }));
  },

  /**
   * Returns the top-N conditions by probability.
   * Use this to summarize likely diagnoses or to focus explanation on the most probable.
   * @param limit - maximum number of conditions to return (default 5)
   */
  readTopConditions: (limit: number = 5): RankedCondition[] => {
    const state = useHealthStore.getState();
    return state.rankedConditions.slice(0, limit);
  },

  /**
   * Returns patient-related context needed for personalization.
   * Use this before generating plan/treatment recommendations tailored to the patient.
   */
  readPatientContext: () => {
    const state = useHealthStore.getState();
    return {
      patientData: state.patientData,
      completedActions: state.completedActions || [],
      lastEvaluatedAt: state.lastEvaluatedAt,
      costWeights: state.costWeights
    };
  },

  /**
   * MUTATION OPERATIONS
   * Modify health state through store actions
   */

  /**
   * Adds or updates a known finding in the state.
   * Use this when the agent extracts a symptom/sign/test result from conversation or user input.
   * @param finding - finding with id and presence (e.g., present/absent)
   */
  addFinding: async (finding: KnownFinding) => {
    const store = useHealthStore.getState();
    console.debug('[AgentBridge] addFinding', finding);
    const res = await store.addFinding(finding);
    console.debug('[AgentBridge] addFinding → recompute triggered');
    return res;
  },

  /**
   * Removes a known finding by ID.
   * Use this to undo or correct an earlier finding entry.
   * @param findingId - id of the finding to remove
   */
  removeFinding: async (findingId: string) => {
    const store = useHealthStore.getState();
    console.debug('[AgentBridge] removeFinding', findingId);
    const res = await store.removeFinding(findingId);
    console.debug('[AgentBridge] removeFinding → recompute triggered');
    return res;
  },

  /**
   * Adds multiple findings sequentially to ensure proper state updates.
   * Use this to batch-import findings parsed from free text.
   * @param findings - list of KnownFinding items
   */
  updateMultipleFindings: async (findings: KnownFinding[]) => {
    const store = useHealthStore.getState();

    // Add findings sequentially to ensure proper state updates
    for (const finding of findings) {
      await store.addFinding(finding);
    }
  },

  /**
   * ACTION OPERATIONS
   * Handle action selection and outcome application
   */

  /**
   * Returns the possible outcomes for a given action.
   * Use this to explain tradeoffs or to choose a specific outcome to apply.
   * @param actionId - action to inspect
   */
  getActionOutcomes: (actionId: string) => {
    const store = useHealthStore.getState();
    return store.getActionOutcomes(actionId);
  },

  /**
   * Resolve a human-friendly outcome name (e.g., "positive") to a canonical outcomeId for an action.
   */
  _resolveOutcomeId: (actionId: string, raw: string): string | null => {
    const store = useHealthStore.getState();
    const outcomes = store.getActionOutcomes(actionId);
    if (!outcomes) return null;
    const list = outcomes.outcomes || [];
    const want = String(raw || '').toLowerCase().trim();

    const exactId = list.find(o => (o.outcomeId || '').toLowerCase() === want)?.outcomeId;
    if (exactId) return exactId;
    const exactLabel = list.find(o => (o.label || '').toLowerCase() === want)?.outcomeId;
    if (exactLabel) return exactLabel;

    const contains = (substr: string) =>
      list.find(o => (o.outcomeId || '').toLowerCase().includes(substr) || (o.label || '').toLowerCase().includes(substr))?.outcomeId || null;

    if (want === 'positive' || want === 'pos' || want === '+') {
      return contains('positive') || contains('pos') || list[0]?.outcomeId || null;
    }
    if (want === 'negative' || want === 'neg' || want === '-') {
      return contains('negative') || contains('neg') || list[1]?.outcomeId || null;
    }
    return contains(want);
  },

  /**
   * Applies a selected outcome for an action and mutates state accordingly.
   * Use this when the user confirms an action choice.
   * @param actionId - action being applied
   * @param outcomeId - chosen outcome of that action
   */
  applyActionOutcome: async (actionId: string, outcomeId: string) => {
    const store = useHealthStore.getState();
    console.debug('[AgentBridge] applyActionOutcome', { actionId, outcomeId });
    const resolved = Agent._resolveOutcomeId(actionId, outcomeId) || outcomeId;
    const res = await store.applyActionOutcome(actionId, resolved);
    console.debug('[AgentBridge] applyActionOutcome → recompute triggered');
    return res;
  },

  /**
   * Executes an action by applying a chosen outcome and updates the board state.
   * Mirrors the UI flow in `top.tsx`: calls the server mutate endpoint then replaces the client snapshot.
   * If running server-side (or the network call fails), falls back to the local store mutation.
   * @param actionId - ID of the action to perform
   * @param outcomeId - ID of the outcome to apply
   * @returns The latest health state snapshot after the mutation
   */
  takeAction: async (actionId: string, outcomeId: string): Promise<HealthState> => {
    // Prefer server-authoritative mutation (same as UI) when in browser
    const isBrowser = typeof window !== 'undefined';
    const store = useHealthStore.getState();

    if (isBrowser) {
      try {
        const resolved = Agent._resolveOutcomeId(actionId, outcomeId) || outcomeId;
        console.debug('[AgentBridge] takeAction → POST /api/state/mutate', { actionId, outcomeId });
        const response = await fetch('/api/state/mutate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: 'applyActionOutcome', payload: { actionId, outcomeId: resolved } })
        });

        if (!response.ok) {
          throw new Error(`Mutate endpoint failed: ${response.status}`);
        }

        const snapshot = await response.json();
        // Hydrate client store with server snapshot to keep parity
        (store as any).replaceAll?.(snapshot);
        console.debug('[AgentBridge] takeAction → store.replaceAll applied');
        return useHealthStore.getState();
      } catch (error) {
        console.warn('[AgentBridge] takeAction server path failed, falling back to local store', error);
        const resolved = Agent._resolveOutcomeId(actionId, outcomeId) || outcomeId;
        await store.applyActionOutcome(actionId, resolved);
        return useHealthStore.getState();
      }
    }

    // Server-side or non-browser: apply directly to the store
    const resolved = Agent._resolveOutcomeId(actionId, outcomeId) || outcomeId;
    console.debug('[AgentBridge] takeAction (server/local) applyActionOutcome', { actionId, outcomeId: resolved });
    await store.applyActionOutcome(actionId, resolved);
    return useHealthStore.getState();
  },

  /**
   * Simulates the effect of choosing an outcome without committing it to state.
   * Use this for "what-if" exploration and planning before making changes.
   * @param actionId - action to simulate
   * @param outcomeId - hypothetical outcome to test
   * @returns currentState and a projectedState (null until implemented)
   */
  simulateActionScenario: async (actionId: string, outcomeId: string): Promise<{
    currentState: HealthState;
    projectedState: HealthState | null;
  }> => {
    const currentState = useHealthStore.getState();

    // TODO: Implement state projection without actually applying changes
    // This would be useful for agent planning and "what-if" scenarios

    console.log(`[Agent] Simulating action ${actionId} with outcome ${outcomeId}`);

    return {
      currentState,
      projectedState: null // Skeleton - implement projection logic
    };
  },

  /**
   * TREATMENT OPERATIONS
   * Manage AI-generated treatment recommendations
   */

  /**
   * Stores an AI-generated treatment recommendation in the state.
   * Use this after external reasoning or API generation to persist the result.
   */
  addRecommendedTreatment: (treatment: TreatmentRecommendation) => {
    const store = useHealthStore.getState();
    store.setTreatmentRecommendation(treatment);
  },

  /**
   * Clears any existing treatment recommendation.
   * Use this before generating a new plan or when the user requests a reset.
   */
  clearTreatments: () => {
    const store = useHealthStore.getState();
    store.clearTreatmentRecommendation();
  },

  /**
   * Calls the treatment generation API and returns the structured recommendation.
   * Use this to trigger server-side/LLM treatment planning based on current state.
   * @returns TreatmentRecommendation or null on failure
   */
  generateTreatmentRecommendation: async (): Promise<TreatmentRecommendation | null> => {
    const state = useHealthStore.getState();

    try {
      // Call the repurposed API route for treatment generation
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'treatment-recommendation',
          data: {
            rankedConditions: state.rankedConditions,
            knownFindings: state.knownFindings,
            engineRecommendation: state.engineRecommendation
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Treatment API failed: ${response.status}`);
      }

      const result = await response.json();

      const treatment: TreatmentRecommendation = {
        generatedAt: new Date().toISOString(),
        rationale: result.rationale || "AI-generated treatment recommendations",
        recommendations: result.recommendations || []
      };

      return treatment;
    } catch (error) {
      console.error('Error generating treatment recommendation:', error);
      return null;
    }
  },

  /**
   * UTILITY OPERATIONS
   * Helper functions for agent decision-making
   */

  /**
   * Returns a simplified urgency assessment and flags.
   * Use this to quickly determine whether to advise urgent care.
   */
  assessUrgency: () => {
    const state = useHealthStore.getState();
    return {
      urgent: state.triage?.urgent || false,
      flags: state.triage?.flags || [],
      recommendation: state.engineRecommendation || "No recommendation available"
    };
  },

  /**
   * Returns high-level metrics summarizing the current engine and store state.
   * Use this for dashboards, summaries, or to decide if more evidence is needed.
   */
  getEngineMetrics: () => {
    const state = useHealthStore.getState();

    const topConditionProbability = state.rankedConditions.length > 0
      ? state.rankedConditions[0].score
      : 0;

    const certaintyLevel = topConditionProbability > 0.8 ? "high" :
                          topConditionProbability > 0.5 ? "medium" : "low";

    return {
      totalFindings: state.knownFindings?.length || 0,
      totalConditions: state.rankedConditions?.length || 0,
      totalActions: state.actionRanking?.length || 0,
      totalUnknowns: state.importantUnknowns?.length || 0,
      topConditionProbability,
      certaintyLevel,
      completedActionCount: state.completedActions?.length || 0,
      lastEvaluatedAt: state.lastEvaluatedAt,
      hasUrgentFlags: state.triage?.urgent || false
    };
  },

  /**
   * PATIENT CONTEXT OPERATIONS
   */

  /**
   * Overwrites patient data with the provided payload.
   * Use this to sync new demographics/history coming from an external source.
   */
  updatePatientData: async (patientData: any) => {
    const store = useHealthStore.getState();
    return store.setPatientData(patientData);
  },

  /**
   * Initializes the store for the given patient ID.
   * Use this when switching profiles or loading a saved patient context.
   */
  initializeWithPatient: async (patientId: string) => {
    const store = useHealthStore.getState();
    return store.init(patientId);
  }
};

/**
 * Agent Bridge for external consumption
 * Provides a clean interface for AI agents to interact with the health system
 */
export default Agent;

/**
 * Utility function to validate agent actions
 */
/**
 * Validates an agent-requested action and its parameters.
 * Use this as a guard before executing actions suggested by an LLM or external agent.
 * @param action - the action name to validate
 * @param parameters - parameters payload to check for required fields
 * @returns { valid, error? }
 */
export function validateAgentAction(action: string, parameters: any): { valid: boolean; error?: string } {
  // Basic validation logic
  const validActions = [
    'readHealthState', 'readConditionInformation', 'addFinding', 'removeFinding',
    'getActionOutcomes', 'applyActionOutcome', 'takeAction', 'addRecommendedTreatment',
    'generateTreatmentRecommendation', 'assessUrgency'
  ];

  if (!validActions.includes(action)) {
    return { valid: false, error: `Unknown action: ${action}` };
  }

  // Add specific parameter validation as needed
  switch (action) {
    case 'addFinding':
      if (!parameters.id || !parameters.presence) {
        return { valid: false, error: 'Finding must have id and presence' };
      }
      break;
    case 'readConditionInformation':
      if (!parameters.conditionId) {
        return { valid: false, error: 'conditionId is required' };
      }
      break;
    case 'applyActionOutcome':
    case 'takeAction':
      if (!parameters.actionId || !parameters.outcomeId) {
        return { valid: false, error: 'actionId and outcomeId are required' };
      }
      break;
  }

  return { valid: true };
}