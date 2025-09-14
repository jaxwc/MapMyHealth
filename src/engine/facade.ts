/**
 * MapMyHealth Engine Facade
 *
 * Clean adapter interface over the existing engine modules.
 * Provides a single entry point for evaluating health states and retrieving condition information.
 */

// Remove fs and path imports - content loading moved to server side
import { buildView } from './viewmodel';
import {
  ContentPack,
  CaseState,
  FindingValue,
  CostWeights,
  EngineInput,
  ViewModelOutput,
  ConditionDef
} from './types';

// Facade types aligned with architecture spec
export type FindingId = string;
export type ConditionId = string;
export type ActionId = string;

export interface PatientData {
  demographics?: { age?: number; sexAtBirth?: "male" | "female" | "other" };
  vitals?: Record<string, number | string>;
  labs?: Record<string, number | string>;
  history?: Record<string, unknown>;
  medications?: string[];
  allergies?: string[];
}

export interface KnownFinding {
  id: FindingId;
  presence: "present" | "absent";
  value?: unknown;
  onset?: string;
  daysSinceOnset?: number;
  severity?: string;
  source?: "user" | "agent" | "patientData" | "system";
}

export interface RankedCondition {
  id: ConditionId;
  name: string;
  score: number;
  statusLabel: "highly-likely" | "likely" | "possible" | "not-likely" | "very-unlikely";
  rationale?: string;
}

export interface UnknownQuestion {
  id: FindingId;
  prompt: string;
  impact: "high" | "medium" | "low";
  rationale?: string;
}

export interface ActionOutcome {
  outcomeId: string;
  description: string;
  affects: {
    findings?: Array<{ id: FindingId; effect: "confirm" | "refute" | "quantify" }>;
    conditions?: Array<{ id: ConditionId; deltaScore: number }>;
  };
  nextSteps?: string[];
  effects?: Array<{
    findingId: string;
    presence: "present" | "absent";
    value?: unknown;
    daysSinceOnset?: number;
  }>;
}

export interface ActionMap {
  catalog: Record<ActionId, { name: string; outcomes: ActionOutcome[] }>;
  root: { label: string };
  transitions: Array<{
    actionId: ActionId;
    actionLabel: string;
    outcomes: Array<{
      outcomeId: string;
      label: string;
      probEstimate: number;
      to: { label: string };
    }>;
  }>;
}

export interface EngineInputs {
  knownFindings: KnownFinding[];
  patientData: PatientData | null;
  costWeights?: CostWeights;
}

export interface ActionRankingItem {
  actionId: ActionId;
  label: string;
  expectedInfoGain: number;
  costs: { money: number; timeHours: number; difficulty: number; risk: number };
  utility: number;
}

export interface EngineOutputs {
  rankedConditions: RankedCondition[];
  importantUnknowns: UnknownQuestion[];
  actionMap: ActionMap;
  actionRanking: ActionRankingItem[];
  triage: { urgent: boolean; flags?: string[] };
  engineRecommendation: string;
}

export interface EngineFacade {
  evaluate(inputs: EngineInputs): Promise<EngineOutputs>;
  getConditionGraph(conditionId: ConditionId): Promise<any>;
  getActionOutcomes(actionId: ActionId): Promise<Array<{
    outcomeId: string;
    label: string;
    probEstimate: number;
    effects: any;
  }>>;
  getContentPack(): ContentPack;
}

/**
 * Internal engine facade implementation
 */
export class EngineFacadeImpl implements EngineFacade {
  private contentPack: ContentPack;
  private defaultCostWeights: CostWeights = {
    infoGainWeight: 1.0,
    money: 0.01,
    timeHours: 0.1,
    difficulty: 0.2,
    risk: 0.5
  };

  constructor(contentPack: ContentPack) {
    this.contentPack = contentPack;
  }

  async evaluate(inputs: EngineInputs): Promise<EngineOutputs> {
    // Convert facade types to engine types
    const caseState: CaseState = this.convertToCaseState(inputs);
    const costWeights = inputs.costWeights || this.defaultCostWeights;

    const engineInput: EngineInput = {
      caseState,
      contentPack: this.contentPack,
      userCostWeights: costWeights
    };

    // Use existing engine
    const viewModel: ViewModelOutput = buildView(engineInput);

    // Convert engine output to facade types
    return this.convertToFacadeOutput(viewModel);
  }

  async getConditionGraph(conditionId: ConditionId): Promise<any> {
    const condition = this.contentPack.conditions.find(c => c.id === conditionId);
    if (!condition) {
      throw new Error(`Condition ${conditionId} not found`);
    }

    // Return full condition with related findings and actions
    const relatedFindings = this.contentPack.findings.filter(f =>
      condition.lrTable.some(lr => lr.target === f.id)
    );

    const relatedActions = this.contentPack.actions.filter(a =>
      a.preconditions?.requireFindings?.includes(conditionId) ||
      a.outcomes.some(o => o.effects.some(e =>
        relatedFindings.some(f => f.id === e.findingId)
      ))
    );

    return {
      condition,
      relatedFindings,
      relatedActions,
      contentPack: this.contentPack
    };
  }

  async getActionOutcomes(actionId: ActionId): Promise<Array<{
    outcomeId: string;
    label: string;
    probEstimate: number;
    effects: any;
  }>> {
    const action = this.contentPack.actions.find(a => a.id === actionId);
    if (!action) {
      throw new Error(`Action ${actionId} not found`);
    }

    return action.outcomes.map(outcome => ({
      outcomeId: outcome.id,
      label: outcome.label,
      probEstimate: outcome.probabilityHint || (1 / action.outcomes.length),
      effects: outcome.effects
    }));
  }

  getContentPack(): ContentPack {
    return this.contentPack;
  }

  private convertToCaseState(inputs: EngineInputs): CaseState {
    const findings: FindingValue[] = inputs.knownFindings.map(kf => ({
      findingId: kf.id,
      presence: kf.presence,
      value: typeof kf.value === 'number' ? kf.value : undefined,
      daysSinceOnset: kf.daysSinceOnset
    }));

    return {
      demographics: inputs.patientData?.demographics ? {
        age: inputs.patientData.demographics.age,
        sexAtBirth: inputs.patientData.demographics.sexAtBirth === 'other' ? undefined :
                   inputs.patientData.demographics.sexAtBirth as "male" | "female"
      } : undefined,
      findings,
      completedActions: []
    };
  }

  private convertToFacadeOutput(viewModel: ViewModelOutput): EngineOutputs {
    const rankedConditions: RankedCondition[] = viewModel.topPanel.rankedConditions.map(rc => ({
      id: rc.id,
      name: rc.label,
      score: rc.probability,
      statusLabel: rc.statusLabel,
      rationale: `${(rc.probability * 100).toFixed(1)}% probability`
    }));

    const importantUnknowns: UnknownQuestion[] = viewModel.topPanel.mostInformativeUnknowns.map(iu => ({
      id: iu.findingId,
      prompt: `Is ${iu.label} present?`,
      impact: iu.infoMetric > 0.3 ? "high" : iu.infoMetric > 0.1 ? "medium" : "low",
      rationale: iu.rationale
    }));

    const actionRanking: ActionRankingItem[] = viewModel.bottomPanel.actionRanking.map(ar => ({
      actionId: ar.actionId,
      label: ar.label,
      expectedInfoGain: ar.expectedInfoGain,
      costs: {
        money: ar.costs.money,
        timeHours: ar.costs.timeHours,
        difficulty: ar.costs.difficulty,
        risk: ar.costs.risk || 0
      },
      utility: ar.utility
    }));

    // Build action catalog and map
    const catalog: Record<ActionId, { name: string; outcomes: ActionOutcome[] }> = {};

    viewModel.bottomPanel.actionRanking.forEach(rankedAction => {
      const action = this.contentPack.actions.find(a => a.id === rankedAction.actionId);
      if (action) {
        catalog[action.id] = {
          name: action.label,
          outcomes: action.outcomes.map(outcome => ({
            outcomeId: outcome.id,
            description: outcome.label,
            affects: {
              findings: outcome.effects.map(effect => ({
                id: effect.findingId,
                effect: effect.presence === "present" ? "confirm" : "refute" as "confirm" | "refute"
              }))
            },
            effects: outcome.effects.map(effect => ({
              findingId: effect.findingId,
              presence: effect.presence === "unknown" ? "absent" : effect.presence as "present" | "absent",
              value: effect.value,
              daysSinceOnset: effect.daysSinceOnset
            }))
          }))
        };
      }
    });

    const actionMap: ActionMap = {
      catalog,
      root: viewModel.bottomPanel.actionTree.root,
      transitions: viewModel.bottomPanel.actionTree.transitions
    };

    return {
      rankedConditions,
      importantUnknowns,
      actionMap,
      actionRanking,
      triage: viewModel.triage,
      engineRecommendation: this.getRecommendationText(viewModel.topPanel.recommendation)
    };
  }

  private getRecommendationText(recommendation: string): string {
    const recommendations: Record<string, string> = {
      'urgent-care': 'Seek urgent medical care immediately',
      'targeted-care': 'Consider targeted medical evaluation and treatment',
      'supportive-care': 'Supportive care and symptom management recommended',
      'watchful-waiting': 'Monitor symptoms and reassess if condition changes'
    };

    return recommendations[recommendation] || recommendation;
  }
}

/**
 * Load content pack from API endpoint (browser-compatible)
 */
async function loadContentPack(): Promise<ContentPack> {
  try {
    const response = await fetch('/api/content-pack');
    if (!response.ok) {
      throw new Error(`Failed to load content pack: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading content pack:', error);
    throw error;
  }
}

/**
 * Factory function to create engine facade
 */
export async function createEngineFacade(): Promise<EngineFacade> {
  const contentPack = await loadContentPack();
  return new EngineFacadeImpl(contentPack);
}