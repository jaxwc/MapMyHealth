/**
 * MapMyHealth Engine - Compiler Module
 * 
 * Purpose: turn beliefs and immediate actions into deterministic user-facing clinical states
 * (for the bottom panel's simple tree and for the top panel's recommendation).
 * 
 * This module compiles belief states into discrete clinical states and generates
 * action trees showing possible outcomes and their resulting states.
 */

import {
  Beliefs,
  ConditionDef,
  ClinicalStateRoot,
  StateTree,
  RankedAction,
  ActionDef,
  TestPerformanceDef,
  Recommendation,
  StateTransition
} from './types';
import { classify } from './beliefs';

/**
 * Compile beliefs into a clinical state root
 * 
 * @param beliefs - Current belief state
 * @param conditionDefs - Condition definitions
 * @returns Clinical state root with label, recommendation, and top beliefs
 * 
 * Behavior: Map posterior to state label via thresholds and assign recommendation
 */
export function compileState(beliefs: Beliefs, conditionDefs: ConditionDef[]): ClinicalStateRoot {
  const classification = classify(beliefs, conditionDefs);
  
  // Get top 3 conditions with labels
  const beliefsTop3 = classification.top.slice(0, 3).map(([conditionId, probability]) => {
    const condition = conditionDefs.find(c => c.id === conditionId);
    return {
      conditionId,
      label: condition?.label || conditionId,
      probability
    };
  });
  
  // Generate state label based on classification
  const stateLabel = generateStateLabel(classification, conditionDefs);
  
  return {
    stateId: "root",
    label: stateLabel,
    recommendation: classification.recommendation,
    beliefsTop3
  };
}

/**
 * Compile action outcomes into a state tree for the UI
 * 
 * @param rootState - Root clinical state
 * @param beliefs - Current belief state
 * @param rankedActions - Top ranked actions
 * @param actions - All action definitions
 * @param conditionDefs - Condition definitions
 * @param testPerf - Test performance definitions
 * @returns State tree with root and transitions
 * 
 * Behavior: build a single-step logic tree (root → action → outcome leaves), 
 * with leaf nodes showing the state the user will land in if that outcome occurs
 */
export function compileActionOutcomesForState(
  rootState: ClinicalStateRoot,
  beliefs: Beliefs,
  rankedActions: RankedAction[],
  actions: ActionDef[],
  conditionDefs: ConditionDef[],
  testPerf: TestPerformanceDef[]
): StateTree {
  const transitions: StateTransition[] = [];
  
  for (const rankedAction of rankedActions) {
    const action = actions.find(a => a.id === rankedAction.actionId);
    if (!action) continue;
    
    const actionTransition: StateTransition = {
      actionId: action.id,
      actionLabel: action.label,
      outcomes: []
    };
    
    // Generate outcomes for this action
    for (const outcome of action.outcomes) {
      const outcomeProb = rankedAction.outcomeProbs[outcome.id] || 0;
      const posteriorBeliefs = rankedAction.previews[outcome.id] || beliefs;
      
      // Compile the state after this outcome
      const outcomeState = compileState(posteriorBeliefs, conditionDefs);
      
      // Calculate delta certainty (how much this outcome changes our confidence)
      const deltaCertainty = calculateDeltaCertainty(beliefs, posteriorBeliefs);
      
      actionTransition.outcomes.push({
        outcomeId: outcome.id,
        label: outcome.label,
        probEstimate: outcomeProb,
        to: {
          label: outcomeState.label,
          recommendation: outcomeState.recommendation,
          beliefsTop3: outcomeState.beliefsTop3
        },
        deltaCertainty
      });
    }
    
    transitions.push(actionTransition);
  }
  
  return {
    root: rootState,
    transitions
  };
}

/**
 * Generate a human-readable state label from classification
 * 
 * @param classification - Classification result
 * @param conditionDefs - Condition definitions
 * @returns Human-readable state label
 */
function generateStateLabel(classification: any, conditionDefs: ConditionDef[]): string {
  const { label, top } = classification;
  
  if (top.length === 0) {
    return "No clear diagnosis";
  }
  
  const [topConditionId, topProbability] = top[0];
  const topCondition = conditionDefs.find(c => c.id === topConditionId);
  const conditionName = topCondition?.label || topConditionId;
  
  switch (label) {
    case "highly-likely":
      return `${conditionName} (highly likely)`;
    case "likely":
      return `${conditionName} (likely)`;
    case "unknown":
      return `Possible ${conditionName}`;
    case "not-likely":
      return `${conditionName} unlikely`;
    case "very-unlikely":
      return `${conditionName} very unlikely`;
    default:
      return "Diagnosis unclear";
  }
}

/**
 * Calculate how much certainty changes between belief states
 * 
 * @param before - Belief state before action
 * @param after - Belief state after action
 * @returns Delta certainty value
 */
function calculateDeltaCertainty(before: Beliefs, after: Beliefs): number {
  // Calculate entropy reduction as a measure of certainty gain
  const entropyBefore = calculateEntropy(before);
  const entropyAfter = calculateEntropy(after);
  const entropyReduction = entropyBefore - entropyAfter;
  
  // Also consider top-1 probability change
  const top1Before = Math.max(...Object.values(before));
  const top1After = Math.max(...Object.values(after));
  const top1Change = top1After - top1Before;
  
  // Combine both metrics (entropy reduction is more important for uncertainty reduction)
  return entropyReduction * 0.7 + top1Change * 0.3;
}

/**
 * Calculate entropy of belief distribution
 * 
 * @param beliefs - Belief state
 * @returns Entropy value
 */
function calculateEntropy(beliefs: Beliefs): number {
  let entropy = 0;
  
  for (const probability of Object.values(beliefs)) {
    if (probability > 0) {
      entropy -= probability * Math.log2(probability);
    }
  }
  
  return entropy;
}

/**
 * Get recommendation category for a state
 * 
 * @param beliefs - Current belief state
 * @param conditionDefs - Condition definitions
 * @returns Recommendation category
 */
export function getRecommendation(beliefs: Beliefs, conditionDefs: ConditionDef[]): Recommendation {
  const classification = classify(beliefs, conditionDefs);
  return classification.recommendation;
}

/**
 * Get top conditions with their status labels
 * 
 * @param beliefs - Current belief state
 * @param conditionDefs - Condition definitions
 * @param maxCount - Maximum number of conditions to return
 * @returns Array of condition rankings with status labels
 */
export function getConditionRankings(
  beliefs: Beliefs, 
  conditionDefs: ConditionDef[], 
  maxCount: number = 5
): Array<{ id: string; label: string; probability: number; statusLabel: "highly-likely" | "likely" | "unknown" | "not-likely" | "very-unlikely" }> {
  const classification = classify(beliefs, conditionDefs);

  return classification.top.slice(0, maxCount).map(([conditionId, probability]) => {
    const condition = conditionDefs.find(c => c.id === conditionId);
    const label = condition?.label || conditionId;

    // Determine status by matching probability band
    let statusLabel: "highly-likely" | "likely" | "unknown" | "not-likely" | "very-unlikely" = "unknown";
    if (condition) {
      const matchingBand = condition.probabilityBands.find(b => probability >= b.minInclusive && probability < b.maxExclusive);
      if (matchingBand) statusLabel = matchingBand.category;
    }

    return {
      id: conditionId,
      label,
      probability,
      statusLabel
    };
  });
}

/**
 * Generate explanation for why a condition is ranked highly
 * 
 * @param conditionId - Condition to explain
 * @param beliefs - Current belief state
 * @param conditionDefs - Condition definitions
 * @returns Explanation with supporting and contradicting findings
 */
export function generateWhyExplanation(
  conditionId: string,
  beliefs: Beliefs,
  conditionDefs: ConditionDef[]
): { supporting: any[]; contradicting: any[] } {
  const condition = conditionDefs.find(c => c.id === conditionId);
  if (!condition) {
    return { supporting: [], contradicting: [] };
  }
  
  const supporting: any[] = [];
  const contradicting: any[] = [];
  
  // This is a simplified implementation
  // In practice, you'd need to track which findings are present/absent
  // and correlate them with the condition's LR table
  
  return { supporting, contradicting };
}
