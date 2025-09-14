/**
 * MapMyHealth Health State Store
 *
 * Zustand store implementing the central health state with invalidation rules.
 * Single source of truth for UI and agent interactions.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { createEngineFacade } from '../../engine/facade';
import { createEscalationProcessor } from '../../engine/escalation';
import type {
  HealthState,
  HealthCommands,
  HealthStore,
  KnownFinding,
  PatientData,
  TreatmentRecommendation,
  CostWeights,
  CompletedAction
} from '../types/health';
import type { ContentPack } from '../../engine/types';
import type { EscalationResult } from '../../engine/escalation';

// Import PatientHealthService (will be implemented next)
import { PatientHealthService } from '../services/PatientHealthService';

// Default cost weights
const DEFAULT_COST_WEIGHTS: CostWeights = {
  infoGainWeight: 1.0,
  money: 0.01,
  timeHours: 0.1,
  difficulty: 0.2,
  risk: 0.5
};

/**
 * Create the health store with all required actions and state management
 */
export const useHealthStore = create<HealthStore>()(
  subscribeWithSelector((set, get) => {
    let enginePromise: Promise<Awaited<ReturnType<typeof createEngineFacade>>> | null = null;

    const getEngine = async () => {
      if (!enginePromise) {
        enginePromise = createEngineFacade();
      }
      return enginePromise;
    };

    // Clear treatment recommendations and escalation results when state changes
    const clearTreatmentsOnChange = () => {
      const { treatmentRecommendation, escalationResult } = get();
      if (treatmentRecommendation || escalationResult) {
        set({
          treatmentRecommendation: undefined,
          escalationResult: undefined
        });
      }
    };

    // Recompute engine outputs based on current state
    const recompute = async () => {
      try {
        const engine = await getEngine();
        const { knownFindings, patientData, costWeights } = get();

        const outputs = await engine.evaluate({
          knownFindings: knownFindings || [],
          patientData,
          costWeights
        });

        set({
          rankedConditions: outputs.rankedConditions,
          importantUnknowns: outputs.importantUnknowns,
          actionMap: outputs.actionMap,
          actionRanking: outputs.actionRanking,
          triage: outputs.triage,
          engineRecommendation: outputs.engineRecommendation,
          escalationResult: undefined, // Clear escalation on recompute
          lastEvaluatedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error recomputing engine outputs:', error);
        // Keep last good results, just update timestamp
        set({ lastEvaluatedAt: new Date().toISOString() });
      }
    };

    // Initial state
    const initialState: HealthState = {
      knownFindings: [],
      rankedConditions: [],
      importantUnknowns: [],
      actionMap: {
        catalog: {},
        root: { label: 'Initial State' },
        transitions: []
      },
      actionRanking: [],
      patientData: null,
      treatmentRecommendation: undefined,
      lastEvaluatedAt: undefined,
      triage: undefined,
      engineRecommendation: undefined,
      escalationResult: undefined,
      costWeights: DEFAULT_COST_WEIGHTS,
      completedActions: [],
      // versioning for synchronization
      stateVersion: 0 as unknown as number
    };

    // Store actions
    const actions: HealthCommands = {
      replaceAll: (next: HealthState) => {
        // Replace the entire client-side mirror with a server snapshot
        set({
          knownFindings: next.knownFindings || [],
          rankedConditions: next.rankedConditions || [],
          importantUnknowns: next.importantUnknowns || [],
          actionMap: next.actionMap || initialState.actionMap,
          actionRanking: next.actionRanking || [],
          patientData: next.patientData || null,
          treatmentRecommendation: next.treatmentRecommendation,
          lastEvaluatedAt: next.lastEvaluatedAt,
          triage: next.triage,
          engineRecommendation: next.engineRecommendation,
          escalationResult: (next as any).escalationResult,
          costWeights: next.costWeights || DEFAULT_COST_WEIGHTS,
          completedActions: next.completedActions || [],
          stateVersion: (next as any).stateVersion ?? get().stateVersion,
        });
      },

      resetAll: async () => {
        // Reset to initial state on server and recompute for a clean baseline
        set({ ...initialState, stateVersion: (get().stateVersion ?? 0) + 1 });
        await recompute();
      },
      init: async (patientId?: string) => {
        if (patientId) {
          try {
            const patientData = await PatientHealthService.fetch(patientId);
            set({ patientData });
          } catch (error) {
            console.error('Error loading patient data:', error);
          }
        }
        await recompute();
      },

      addFinding: async (finding: KnownFinding) => {
        // Validate finding id against content pack
        try {
          const engine = await getEngine();
          const content: ContentPack = engine.getContentPack();
          const validIds = new Set(content.findings.map(f => f.id));
          if (!validIds.has(finding.id)) {
            console.warn(`[healthStore] Rejecting unknown finding id: ${finding.id}`);
            return; // Silently ignore invalid additions
          }
        } catch (err) {
          console.error('Error validating finding id:', err);
        }

        set((state) => ({
          knownFindings: [...(state.knownFindings || []), finding],
          stateVersion: (state.stateVersion ?? 0) + 1
        }));
        clearTreatmentsOnChange();
        await recompute();
      },

      removeFinding: async (id: string) => {
        set((state) => ({
          knownFindings: (state.knownFindings || []).filter(f => f.id !== id),
          stateVersion: (state.stateVersion ?? 0) + 1
        }));
        clearTreatmentsOnChange();
        await recompute();
      },

      setPatientData: async (patientData: PatientData) => {
        set((state) => ({ patientData, stateVersion: (state.stateVersion ?? 0) + 1 }));
        clearTreatmentsOnChange();
        await recompute();
      },

      recompute,

      clearTreatmentRecommendation: () => {
        set({ treatmentRecommendation: undefined });
      },

      setTreatmentRecommendation: (treatment: TreatmentRecommendation) => {
        set({ treatmentRecommendation: treatment });
      },

      getActionOutcomes: (actionId: string) => {
        const { actionMap } = get();
        const catalogEntry = actionMap.catalog[actionId];
        if (!catalogEntry) return null;

        // Merge probabilities from transitions if available
        const transition = actionMap.transitions.find(t => t.actionId === actionId);
        const probByOutcome: Record<string, number> = {};

        if (transition) {
          transition.outcomes.forEach(o => {
            probByOutcome[o.outcomeId] = o.probEstimate;
          });
        }

        return {
          outcomes: catalogEntry.outcomes.map(o => ({
            ...o,
            probEstimate: probByOutcome[o.outcomeId] ?? 0
          }))
        };
      },

      setCostWeights: async (weights: CostWeights) => {
        set({ costWeights: weights });
        await recompute();
      },

      applyActionOutcome: async (actionId: string, outcomeId: string) => {
        const { actionMap, knownFindings, triage, completedActions } = get();
        const entry = actionMap.catalog[actionId];
        const outcome = entry?.outcomes.find(o => o.outcomeId === outcomeId);

        if (!outcome) {
          console.error(`Outcome ${outcomeId} not found for action ${actionId}`);
          return;
        }

        let escalationResult: EscalationResult | undefined;

        // Process escalation if engine is available
        try {
          const engine = await getEngine();
          const contentPack = engine.getContentPack();
          const escalationProcessor = createEscalationProcessor(contentPack);

          if (outcome.effects && escalationProcessor.shouldProcessEscalation(outcome.effects)) {
            const findingValues = (knownFindings || []).map(f => ({
              findingId: f.id,
              presence: f.presence,
              value: typeof f.value === 'number' ? f.value : undefined,
              daysSinceOnset: f.daysSinceOnset
            }));

            const currentCaseState = {
              demographics: undefined,
              findings: findingValues,
              completedActions: (completedActions || []).map(ca => ({
                actionId: ca.actionId,
                outcomeId: ca.outcomeId,
                at: new Date(ca.at)
              }))
            };

            escalationResult = escalationProcessor.processOutcomeEscalation(
              actionId,
              outcomeId,
              outcome.effects,
              triage || { urgent: false },
              currentCaseState
            );
          }
        } catch (error) {
          console.error('Error processing escalation:', error);
        }

        set((state) => {
          const updatedFindings = [...(state.knownFindings || [])];

          // Apply effects from outcome
          if (outcome.effects) {
            for (const effect of outcome.effects) {
              const existingIndex = updatedFindings.findIndex(f => f.id === effect.findingId);

              const newFinding: KnownFinding = {
                id: effect.findingId,
                presence: effect.presence,
                value: effect.value,
                daysSinceOnset: effect.daysSinceOnset,
                source: 'system'
              };

              if (existingIndex >= 0) {
                updatedFindings[existingIndex] = { ...updatedFindings[existingIndex], ...newFinding };
              } else {
                updatedFindings.push(newFinding);
              }
            }
          }

          const newCompletedAction: CompletedAction = {
            actionId,
            outcomeId,
            at: new Date().toISOString()
          };

          return {
            knownFindings: updatedFindings,
            completedActions: [...(state.completedActions || []), newCompletedAction],
            treatmentRecommendation: undefined, // Clear on state change
            escalationResult, // Store escalation result
            triage: escalationResult?.newTriage || state.triage, // Update triage if escalated
            stateVersion: (state.stateVersion ?? 0) + 1
          };
        });

        await recompute();
      }
    };

    return {
      ...initialState,
      ...actions
    };
  })
);

// Export selector helpers for common patterns
export const selectRankedConditions = (state: HealthState) => state.rankedConditions;
export const selectKnownFindings = (state: HealthState) => state.knownFindings;
export const selectImportantUnknowns = (state: HealthState) => state.importantUnknowns;
export const selectActionRanking = (state: HealthState) => state.actionRanking;
export const selectTriage = (state: HealthState) => state.triage;
export const selectTreatmentRecommendation = (state: HealthState) => state.treatmentRecommendation;