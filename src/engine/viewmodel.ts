/**
 * MapMyHealth Engine - ViewModel Module
 * 
 * Purpose: assemble everything the UI needs (two panels) from the above modules.
 * 
 * This module is the main entry point for the UI, orchestrating all engine modules
 * to produce the complete view model for both the top and bottom panels.
 */

import { 
  EngineInput, 
  ViewModelOutput, 
  TriageResult, 
  TopPanelData, 
  BottomPanelData,
  FindingLite,
  ConditionRanking,
  WhyExplanation,
  UnknownFindingInfo,
  ActionRanking,
  FindingDef,
  ConditionDef,
  ActionDef,
  TestPerformanceDef,
  CaseState
} from './types';

import { checkRedFlags } from './triage';
import { seedPriors, applyEvidence, classify } from './beliefs';
import { mostInformativeUnknowns, scoreActionVOI } from './influence';
import { rankActions, planBranches } from './planner';
import { compileState, compileActionOutcomesForState, getConditionRankings, generateWhyExplanation } from './compiler';

/**
 * Build the complete view model for the UI
 * 
 * @param input - Engine input with case state, content pack, and cost weights
 * @returns Complete view model output for both panels
 * 
 * Behavior:
 * - Runs triage; if urgent, populates top panel with banner and omits planning
 * - Else computes beliefs → classification → VOI → ranked actions → one-step action tree (and optional plan branches)
 */
export function buildView(input: EngineInput): ViewModelOutput {
  const { caseState, contentPack, userCostWeights } = input;
  
  // Step 1: Check for red flags
  const triage = checkRedFlags(caseState, contentPack.findings);
  
  if (triage.urgent) {
    // If urgent, return minimal view with red flag banner
    return buildUrgentView(triage, caseState, contentPack);
  }
  
  // Step 2: Compute beliefs
  const priors = seedPriors(caseState, contentPack.conditions);
  const beliefs = applyEvidence(priors, caseState, contentPack.conditions, contentPack.testPerformance);
  
  // Step 3: Classify beliefs
  const classification = classify(beliefs, contentPack.conditions);
  
  // Step 4: Build top panel data
  const topPanel = buildTopPanel(caseState, beliefs, contentPack, classification);
  
  // Step 5: Build bottom panel data
  const bottomPanel = buildBottomPanel(
    caseState, 
    beliefs, 
    contentPack, 
    userCostWeights,
    classification
  );
  
  return {
    triage,
    topPanel,
    bottomPanel
  };
}

/**
 * Build view for urgent cases (red flags present)
 * 
 * @param triage - Triage result with red flags
 * @param caseState - Current case state
 * @param contentPack - Content pack
 * @returns Urgent view model
 */
function buildUrgentView(
  triage: TriageResult, 
  caseState: CaseState, 
  contentPack: any
): ViewModelOutput {
  const topPanel: TopPanelData = {
    knownFindings: {
      present: getKnownFindings(caseState, contentPack.findings, "present"),
      absent: getKnownFindings(caseState, contentPack.findings, "absent")
    },
    rankedConditions: [],
    recommendation: "urgent-care",
    why: [],
    mostInformativeUnknowns: []
  };
  
  const bottomPanel: BottomPanelData = {
    actionRanking: [],
    actionTree: {
      root: {
        stateId: "root",
        label: "URGENT: Red flags detected",
        recommendation: "urgent-care",
        beliefsTop3: []
      },
      transitions: []
    }
  };
  
  return {
    triage,
    topPanel,
    bottomPanel
  };
}

/**
 * Build top panel data
 * 
 * @param caseState - Current case state
 * @param beliefs - Current belief state
 * @param contentPack - Content pack
 * @param classification - Belief classification
 * @returns Top panel data
 */
function buildTopPanel(
  caseState: CaseState,
  beliefs: any,
  contentPack: any,
  classification: any
): TopPanelData {
  // Get known findings
  const knownFindings = {
    present: getKnownFindings(caseState, contentPack.findings, "present"),
    absent: getKnownFindings(caseState, contentPack.findings, "absent")
  };
  
  // Get ranked conditions
  const rankedConditions = getConditionRankings(beliefs, contentPack.conditions, 5);
  
  // Get most informative unknowns
  const informativeUnknowns = mostInformativeUnknowns(
    beliefs,
    contentPack.conditions,
    contentPack.findings,
    5,
    caseState
  ).map(unknown => ({
    findingId: unknown.findingId,
    label: contentPack.findings.find((f: FindingDef) => f.id === unknown.findingId)?.label || unknown.findingId,
    infoMetric: unknown.metric,
    rationale: unknown.rationale
  }));
  
  // Generate why explanations for top conditions
  const why: WhyExplanation[] = [];
  for (const condition of rankedConditions.slice(0, 3)) {
    const explanation = generateWhyExplanation(condition.id, beliefs, contentPack.conditions);
    why.push({
      conditionId: condition.id,
      supporting: explanation.supporting,
      contradicting: explanation.contradicting
    });
  }
  
  return {
    knownFindings,
    rankedConditions,
    recommendation: classification.recommendation,
    why,
    mostInformativeUnknowns: informativeUnknowns
  };
}

/**
 * Build bottom panel data
 * 
 * @param caseState - Current case state
 * @param beliefs - Current belief state
 * @param contentPack - Content pack
 * @param userCostWeights - User cost weights
 * @param classification - Belief classification
 * @returns Bottom panel data
 */
function buildBottomPanel(
  caseState: CaseState,
  beliefs: any,
  contentPack: any,
  userCostWeights: any,
  classification: any
): BottomPanelData {
  // Rank actions
  const rankedActions = rankActions(
    caseState,
    beliefs,
    contentPack.actions,
    contentPack.conditions,
    contentPack.testPerformance,
    userCostWeights,
    3
  );
  
  // Build action ranking for display
  const actionRanking: ActionRanking[] = rankedActions.map(ranked => {
    const action = contentPack.actions.find((a: ActionDef) => a.id === ranked.actionId);
    return {
      actionId: ranked.actionId,
      label: action?.label || ranked.actionId,
      utility: ranked.utility,
      expectedInfoGain: ranked.expectedInfoGain,
      costs: ranked.costs,
      outcomeProbs: ranked.outcomeProbs
    };
  });
  
  // Compile state tree
  const rootState = compileState(beliefs, contentPack.conditions);
  const actionTree = compileActionOutcomesForState(
    rootState,
    beliefs,
    rankedActions,
    contentPack.actions,
    contentPack.conditions,
    contentPack.testPerformance
  );
  
  // Generate plan preview (optional)
  const planPreview = planBranches(
    caseState,
    beliefs,
    contentPack.actions,
    contentPack.conditions,
    contentPack.testPerformance,
    userCostWeights,
    2, // depth
    3  // beam width
  );
  
  return {
    actionRanking,
    actionTree,
    planPreview
  };
}

/**
 * Get known findings of a specific presence type
 * 
 * @param caseState - Current case state
 * @param findingDefs - Finding definitions
 * @param presence - Presence type to filter by
 * @returns Array of finding lite objects
 */
function getKnownFindings(
  caseState: CaseState,
  findingDefs: FindingDef[],
  presence: "present" | "absent"
): FindingLite[] {
  return caseState.findings
    .filter(finding => finding.presence === presence)
    .map(finding => {
      const findingDef = findingDefs.find(f => f.id === finding.findingId);
      return {
        id: finding.findingId,
        label: findingDef?.label || finding.findingId,
        kind: findingDef?.kind || "symptom",
        presence: finding.presence,
        value: finding.value,
        daysSinceOnset: finding.daysSinceOnset
      };
    });
}

/**
 * Calculate certainty delta between belief states
 * 
 * @param before - Belief state before
 * @param after - Belief state after
 * @returns Certainty delta
 */
function calculateCertaintyDelta(before: any, after: any): number {
  const top1Before = Math.max(...Object.values(before) as number[]);
  const top1After = Math.max(...Object.values(after) as number[]);
  return top1After - top1Before;
}

/**
 * Get action utility score for ranking
 * 
 * @param action - Action definition
 * @param beliefs - Current beliefs
 * @param conditionDefs - Condition definitions
 * @param testPerf - Test performance definitions
 * @param costWeights - Cost weights
 * @returns Utility score
 */
function getActionUtility(
  action: ActionDef,
  beliefs: any,
  conditionDefs: ConditionDef[],
  testPerf: TestPerformanceDef[],
  costWeights: any
): number {
  const voi = scoreActionVOI(beliefs, action, conditionDefs, testPerf, costWeights);
  return voi.utility;
}
