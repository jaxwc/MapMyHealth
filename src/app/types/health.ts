/**
 * MapMyHealth Application Types
 *
 * Shared types for the application state layer, aligned with engine types
 * where possible but designed for UI and agent consumption.
 */

// Re-export facade types for consistency
export type {
  FindingId,
  ConditionId,
  ActionId,
  PatientData,
  KnownFinding,
  RankedCondition,
  UnknownQuestion,
  ActionOutcome,
  ActionMap,
  EngineInputs,
  ActionRankingItem,
  EngineOutputs
} from '../../engine/facade';

// Additional application-specific types
export interface TreatmentRecommendation {
  generatedAt: string;
  rationale?: string;
  recommendations: Array<{
    conditionId: string;
    title: string;
    details?: string;
    strength?: "A" | "B" | "C";
  }>;
}

export interface CostWeights {
  infoGainWeight: number;
  money: number;
  timeHours: number;
  difficulty: number;
  risk: number;
}

export interface CompletedAction {
  actionId: string;
  outcomeId: string;
  at: string;
}

/**
 * Central application health state
 * Single source of truth for UI and agent
 */
export interface HealthState {
  // Core data
  knownFindings: import('../../engine/facade').KnownFinding[];
  rankedConditions: import('../../engine/facade').RankedCondition[];
  importantUnknowns: import('../../engine/facade').UnknownQuestion[];
  actionMap: import('../../engine/facade').ActionMap;
  actionRanking: import('../../engine/facade').ActionRankingItem[];

  // Patient context
  patientData: import('../../engine/facade').PatientData | null;

  // Engine outputs
  triage?: { urgent: boolean; flags?: string[] };
  engineRecommendation?: string;

  // Escalation state
  escalationResult?: import('../../engine/escalation').EscalationResult;

  // User preferences
  costWeights?: CostWeights;

  // Action history
  completedActions?: CompletedAction[];

  // Treatment AI output (cleared on state changes)
  treatmentRecommendation?: TreatmentRecommendation;

  // Metadata
  lastEvaluatedAt?: string;

  // Versioning for synchronization
  stateVersion?: number;
}

/**
 * Store action interface
 */
export interface HealthCommands {
  init(patientId?: string): Promise<void>;
  addFinding(f: import('../../engine/facade').KnownFinding): Promise<void>;
  removeFinding(id: string): Promise<void>;
  setPatientData(p: import('../../engine/facade').PatientData): Promise<void>;
  recompute(): Promise<void>;
  clearTreatmentRecommendation(): void;
  setTreatmentRecommendation(t: TreatmentRecommendation): void;
  getActionOutcomes(actionId: string): { outcomes: any[] } | null;
  setCostWeights(w: CostWeights): Promise<void>;
  applyActionOutcome(actionId: string, outcomeId: string): Promise<void>;

  // Synchronization utilities
  replaceAll(next: HealthState): void;
  resetAll(): Promise<void>;
}

/**
 * Complete store type
 */
export type HealthStore = HealthState & HealthCommands;