/**
 * MapMyHealth Engine - TypeScript Types
 * 
 * Core type definitions for the medical recommendation system engine.
 * These types define the contracts between engine modules and the UI.
 */

// Common Types
export type ID = string;
export type Presence = "present" | "absent" | "unknown";
export type Recommendation = "urgent-care" | "targeted-care" | "supportive-care" | "watchful-waiting";
export type FindingKind = "symptom" | "testFinding" | "vital" | "history" | "redFlag";
export type ActionKind = "Test" | "Question" | "WaitObserve" | "TrialTreatment";

// Source metadata for evidence and performance data
export interface SourceMeta {
  source: string;
  year?: number;
  note?: string;
}

// Content Pack DTOs (from src/content/ folder)
export interface FindingDef {
  id: ID;
  label: string;
  kind: FindingKind;
  units?: string;
  isRedFlag?: boolean;
}

export interface ConditionDef {
  id: ID;
  label: string;
  description: string;
  priors: {
    default: number;
    byDemo?: Array<{
      ageRange?: { min?: number; max?: number };
      sexAtBirth?: "male" | "female";
      season?: "spring" | "summer" | "fall" | "winter";
      prior: number;
    }>;
  };
  probabilityBands: Array<{
    category: "highly-likely" | "likely" | "possible" | "not-likely" | "very-unlikely";
    minInclusive: number;
    maxExclusive: number;
  }>;
  lrTable: Array<{
    target: ID; // findingId or bucketId
    LRpos: number;
    LRneg: number;
    note?: string;
    source: SourceMeta;
  }>;
  recommendationsByBand: Record<
    "highly-likely" | "likely" | "possible" | "not-likely" | "very-unlikely",
    Recommendation
  >;
}

export interface ActionDef {
  id: ID;
  label: string;
  kind: ActionKind;
  preconditions?: {
    requireFindings?: ID[];
    forbidFindings?: ID[];
    requireActions?: ID[];
  };
  costs: {
    money: number;
    timeHours: number;
    difficulty: number;
    risk?: number;
  };
  testBinding?: {
    findingIdPositive: ID;
    findingIdNegative: ID;
    performanceRefId: ID;
  };
  waitBinding?: {
    hours: number;
    outcomes: string[];
    findingEffectsByOutcome: Record<string, FindingEffect[]>;
  };
  outcomes: Array<{
    id: ID;
    label: string;
    probabilityHint?: number;
    effects: FindingEffect[];
  }>;
  sideEffects?: {
    suppressFindingIds?: ID[];
    decayHours?: number;
  };
}

export interface FindingEffect {
  findingId: ID;
  presence: Presence;
  value?: number;
  daysSinceOnset?: number;
}

export interface TestPerformanceDef {
  id: ID;
  testId: ID;
  sensitivity: number;
  specificity: number;
  piecewiseByDaysSinceOnset?: Array<{
    daysRange: { min?: number; max?: number };
    sensitivity: number;
    specificity: number;
  }>;
  source: SourceMeta;
}

export interface ContentPack {
  meta: {
    name: string;
    version: string;
    jurisdiction?: string;
    source: SourceMeta;
  };
  findings: FindingDef[];
  conditions: ConditionDef[];
  actions: ActionDef[];
  testPerformance: TestPerformanceDef[];
}

// Case State (from UI to engine)
export interface Demographics {
  age?: number;
  sexAtBirth?: "male" | "female";
  pregnant?: boolean;
}

export interface FindingValue {
  findingId: ID;
  presence: Presence;
  value?: number;
  daysSinceOnset?: number;
}

export interface CompletedAction {
  actionId: ID;
  outcomeId: ID;
  at: Date;
}

export interface CaseState {
  demographics?: Demographics;
  findings: FindingValue[];
  completedActions: CompletedAction[];
}

// Beliefs and Classification
export interface Beliefs {
  [conditionId: ID]: number; // probabilities that sum to 1
}

export interface Classification {
  top: Array<[ID, number]>; // [conditionId, probability]
  label: "highly-likely" | "likely" | "possible" | "not-likely" | "very-unlikely";
  recommendation: Recommendation;
}

// Influence and VOI
export interface UnknownInfo {
  findingId: ID;
  metric: number;
  rationale: string;
}

export interface ActionVOI {
  expectedInfoGain: number;
  expectedOutcomeProbs: Record<ID, number>;
  utility: number;
  previewPosteriors: Record<ID, Beliefs>;
}

export interface RankedAction {
  actionId: ID;
  utility: number;
  expectedInfoGain: number;
  costs: ActionDef['costs'];
  outcomeProbs: Record<ID, number>;
  previews: Record<ID, Beliefs>;
}

// Planning and Branching
export interface Branch {
  id: ID;
  steps: Array<{
    actionId: ID;
    outcomeId?: ID;
    predictedOutcomeProbs: Record<ID, number>;
    posteriorPreview: Beliefs;
    accumCosts: ActionDef['costs'];
  }>;
  expectedUtility: number;
  leafPosteriorPreview: Beliefs;
}

// Compiler outputs
export interface ClinicalStateRoot {
  stateId: "root";
  label: string;
  recommendation: Recommendation;
  beliefsTop3: Array<{ conditionId: ID; label: string; probability: number }>;
}

export interface StateTransition {
  actionId: ID;
  actionLabel: string;
  outcomes: Array<{
    outcomeId: ID;
    label: string;
    probEstimate: number;
    to: {
      label: string;
      recommendation: Recommendation;
      beliefsTop3: Array<{ conditionId: ID; label: string; probability: number }>;
    };
    deltaCertainty: number;
  }>;
}

export interface StateTree {
  root: ClinicalStateRoot;
  transitions: StateTransition[];
}

// ViewModel outputs
export interface FindingLite {
  id: ID;
  label: string;
  kind: FindingKind;
  presence: Presence;
  value?: number;
  daysSinceOnset?: number;
}

export interface FindingChip {
  findingId: ID;
  label: string;
  strength: "strong" | "moderate" | "weak";
}

export interface ConditionRanking {
  id: ID;
  label: string;
  probability: number;
  statusLabel: "highly-likely" | "likely" | "possible" | "not-likely" | "very-unlikely";
}

export interface WhyExplanation {
  conditionId: ID;
  supporting: FindingChip[];
  contradicting: FindingChip[];
}

export interface UnknownFindingInfo {
  findingId: ID;
  label: string;
  infoMetric: number;
  rationale: string;
}

export interface ActionRanking {
  actionId: ID;
  label: string;
  utility: number;
  expectedInfoGain: number;
  costs: ActionDef['costs'];
  outcomeProbs: Record<ID, number>;
}

// Escalation system types
export interface EscalationRule {
  condition: string; // "symptom_worsening"
  action: "urgent_care" | "reevaluate" | "add_actions" | "change_triage";
  parameters?: any;
}

export interface UrgencyEffect {
  urgent: boolean;
  reason: string;
  flags?: string[];
}

export interface NextActionEffect {
  actionIds: string[];
  priority: "high" | "medium" | "low";
}

export interface EscalationAction {
  type: "urgent_care" | "add_actions" | "change_triage" | "notify_provider";
  reason: string;
  parameters: any;
}

export interface ActionChain {
  id: string;
  trigger: string;
  requiredPrecedingAction: string;
  chainedActions: string[];
  automaticProgression?: boolean;
}

export interface TriageResult {
  urgent: boolean;
  flags?: ID[];
}

export interface TopPanelData {
  knownFindings: {
    present: FindingLite[];
    absent: FindingLite[];
  };
  rankedConditions: ConditionRanking[];
  recommendation: Recommendation;
  why: WhyExplanation[];
  mostInformativeUnknowns: UnknownFindingInfo[];
}

export interface BottomPanelData {
  actionRanking: ActionRanking[];
  actionTree: StateTree;
  planPreview?: Branch[];
}

export interface ViewModelOutput {
  triage: TriageResult;
  topPanel: TopPanelData;
  bottomPanel: BottomPanelData;
}

// Cost weights for utility calculations
export interface CostWeights {
  infoGainWeight: number;
  money: number;
  timeHours: number;
  difficulty: number;
  risk: number;
}

// Engine input
export interface EngineInput {
  caseState: CaseState;
  contentPack: ContentPack;
  userCostWeights: CostWeights;
}
