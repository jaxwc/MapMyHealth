/**
 * MapMyHealth Engine - Influence Module
 * 
 * Purpose: quantify how much an unknown data point or an action could change certainty.
 * 
 * This module implements value-of-information (VOI) calculations to determine
 * which unknowns are most informative and which actions provide the most utility.
 */

import {
  Beliefs,
  ConditionDef,
  FindingDef,
  ActionDef,
  TestPerformanceDef,
  UnknownInfo,
  ActionVOI,
  CaseState
} from './types';
import { applyEvidence } from './beliefs';

/**
 * Find the most informative unknown findings
 * 
 * @param beliefs - Current belief state
 * @param conditionDefs - Condition definitions with LR tables
 * @param findingDefs - All finding definitions
 * @param k - Number of top unknowns to return (default 5)
 * @returns Array of most informative unknown findings
 * 
 * Behavior: score unknown findings by expected entropy reduction or expected top-1 gain
 */
export function mostInformativeUnknowns(
  beliefs: Beliefs,
  conditionDefs: ConditionDef[],
  findingDefs: FindingDef[],
  k: number = 5
): UnknownInfo[] {
  const unknownFindings = findingDefs.filter(finding => 
    !beliefs || Object.keys(beliefs).length === 0 || 
    !hasKnownValue(finding.id, beliefs, conditionDefs)
  );
  
  const scoredUnknowns: UnknownInfo[] = [];
  
  for (const finding of unknownFindings) {
    const metric = calculateInformationMetric(finding, beliefs, conditionDefs);
    const rationale = generateRationale(finding, beliefs, conditionDefs);
    
    scoredUnknowns.push({
      findingId: finding.id,
      metric,
      rationale
    });
  }
  
  // Sort by metric (descending) and return top k
  return scoredUnknowns
    .sort((a, b) => b.metric - a.metric)
    .slice(0, k);
}

/**
 * Score an action's value of information
 * 
 * @param beliefs - Current belief state
 * @param actionDef - Action definition to score
 * @param conditionDefs - Condition definitions
 * @param testPerf - Test performance definitions
 * @param costWeights - Cost weights for utility calculation
 * @returns Action VOI with expected info gain, outcome probs, utility, and preview posteriors
 * 
 * Behavior: compute outcome posteriors, outcome probabilities, information gain, and cost-weighted utility
 */
export function scoreActionVOI(
  beliefs: Beliefs,
  actionDef: ActionDef,
  conditionDefs: ConditionDef[],
  testPerf: TestPerformanceDef[],
  costWeights: any
): ActionVOI {
  const expectedOutcomeProbs: Record<string, number> = {};
  const previewPosteriors: Record<string, Beliefs> = {};
  
  // Calculate outcome probabilities and posteriors for each outcome
  for (const outcome of actionDef.outcomes) {
    const outcomeProb = calculateOutcomeProbability(outcome, actionDef, beliefs, conditionDefs, testPerf);
    expectedOutcomeProbs[outcome.id] = outcomeProb;
    
    // Calculate posterior beliefs if this outcome occurs
    const posterior = calculateOutcomePosterior(outcome, beliefs, conditionDefs, testPerf);
    previewPosteriors[outcome.id] = posterior;
  }
  
  // Calculate expected information gain
  const expectedInfoGain = calculateExpectedInformationGain(
    beliefs,
    expectedOutcomeProbs,
    previewPosteriors
  );
  
  // Calculate utility = infoGainWeight * expectedInfoGain - Σ(weights * costs)
  const utility = (costWeights.infoGainWeight * expectedInfoGain) - 
    (costWeights.money * actionDef.costs.money +
     costWeights.timeHours * actionDef.costs.timeHours +
     costWeights.difficulty * actionDef.costs.difficulty +
     (costWeights.risk || 0) * (actionDef.costs.risk || 0));
  
  return {
    expectedInfoGain,
    expectedOutcomeProbs,
    utility,
    previewPosteriors
  };
}

/**
 * Check if a finding has a known value in the current beliefs
 * 
 * @param findingId - ID of the finding to check
 * @param beliefs - Current belief state
 * @param conditionDefs - Condition definitions
 * @returns true if the finding has a known value
 */
function hasKnownValue(findingId: string, beliefs: Beliefs, conditionDefs: ConditionDef[]): boolean {
  // This is a simplified check - in a real implementation, you'd need to track
  // which findings have been observed in the case state
  return false; // For now, assume all findings are unknown
}

/**
 * Calculate information metric for an unknown finding
 * 
 * @param finding - Finding definition
 * @param beliefs - Current belief state
 * @param conditionDefs - Condition definitions
 * @returns Information metric value
 */
function calculateInformationMetric(
  finding: FindingDef,
  beliefs: Beliefs,
  conditionDefs: ConditionDef[]
): number {
  // Calculate expected entropy reduction if we were to observe this finding
  const currentEntropy = calculateEntropy(beliefs);
  
  // Simulate both positive and negative outcomes
  const positiveEntropy = simulateFindingOutcome(finding, beliefs, conditionDefs, "present");
  const negativeEntropy = simulateFindingOutcome(finding, beliefs, conditionDefs, "absent");
  
  // Use equal probability for unknown outcomes (could be improved with more sophisticated modeling)
  const expectedEntropy = (positiveEntropy + negativeEntropy) / 2;
  const entropyReduction = currentEntropy - expectedEntropy;
  
  return Math.max(0, entropyReduction);
}

/**
 * Generate rationale for why a finding is informative
 * 
 * @param finding - Finding definition
 * @param beliefs - Current belief state
 * @param conditionDefs - Condition definitions
 * @returns Rationale string
 */
function generateRationale(
  finding: FindingDef,
  beliefs: Beliefs,
  conditionDefs: ConditionDef[]
): string {
  // Find conditions that would be most affected by this finding
  const affectedConditions = conditionDefs.filter(condition => 
    condition.lrTable.some(lr => lr.target === finding.id)
  );
  
  if (affectedConditions.length === 0) {
    return `Finding ${finding.label} has no known associations with current conditions`;
  }
  
  const topCondition = affectedConditions[0];
  return `Finding ${finding.label} strongly influences ${topCondition.label} diagnosis`;
}

/**
 * Calculate outcome probability for an action outcome
 * 
 * @param outcome - Action outcome
 * @param actionDef - Action definition
 * @param beliefs - Current belief state
 * @param conditionDefs - Condition definitions
 * @param testPerf - Test performance definitions
 * @returns Probability of this outcome occurring
 */
function calculateOutcomeProbability(
  outcome: any,
  actionDef: ActionDef,
  beliefs: Beliefs,
  conditionDefs: ConditionDef[],
  testPerf: TestPerformanceDef[]
): number {
  // For tests, use sensitivity/specificity based on current beliefs
  if (actionDef.kind === "Test" && actionDef.testBinding) {
    const testPerfDef = testPerf.find(tp => tp.id === actionDef.testBinding!.performanceRefId);
    if (testPerfDef) {
      // Estimate probability of positive test based on current beliefs
      const positiveProbability = estimateTestPositiveProbability(beliefs, conditionDefs, testPerfDef);
      
      if (outcome.id === actionDef.testBinding.findingIdPositive) {
        return positiveProbability;
      } else if (outcome.id === actionDef.testBinding.findingIdNegative) {
        return 1 - positiveProbability;
      }
    }
  }
  
  // For other outcomes, use probability hint or equal distribution
  if (outcome.probabilityHint !== undefined) {
    return outcome.probabilityHint;
  }
  
  return 1 / actionDef.outcomes.length;
}

/**
 * Calculate posterior beliefs after an outcome
 * 
 * @param outcome - Action outcome
 * @param beliefs - Current belief state
 * @param conditionDefs - Condition definitions
 * @param testPerf - Test performance definitions
 * @returns Updated beliefs after outcome
 */
function calculateOutcomePosterior(
  outcome: any,
  beliefs: Beliefs,
  conditionDefs: ConditionDef[],
  testPerf: TestPerformanceDef[]
): Beliefs {
  // Create a mock case state with the outcome finding
  const mockCaseState: CaseState = {
    findings: outcome.effects.map((effect: any) => ({
      findingId: effect.findingId,
      presence: effect.presence,
      value: effect.value,
      daysSinceOnset: effect.daysSinceOnset
    })),
    completedActions: []
  };
  
  // Apply evidence to get posterior beliefs
  return applyEvidence(beliefs, mockCaseState, conditionDefs, testPerf);
}

/**
 * Calculate expected information gain across outcomes
 * 
 * @param beliefs - Current belief state
 * @param outcomeProbs - Outcome probabilities
 * @param posteriors - Posterior beliefs for each outcome
 * @returns Expected information gain
 */
function calculateExpectedInformationGain(
  beliefs: Beliefs,
  outcomeProbs: Record<string, number>,
  posteriors: Record<string, Beliefs>
): number {
  const currentEntropy = calculateEntropy(beliefs);
  let expectedEntropy = 0;
  
  for (const [outcomeId, prob] of Object.entries(outcomeProbs)) {
    const posterior = posteriors[outcomeId];
    const posteriorEntropy = calculateEntropy(posterior);
    expectedEntropy += prob * posteriorEntropy;
  }
  
  return Math.max(0, currentEntropy - expectedEntropy);
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
 * Simulate finding outcome and calculate resulting entropy
 * 
 * @param finding - Finding definition
 * @param beliefs - Current belief state
 * @param conditionDefs - Condition definitions
 * @param presence - Presence value to simulate
 * @returns Resulting entropy
 */
function simulateFindingOutcome(
  finding: FindingDef,
  beliefs: Beliefs,
  conditionDefs: ConditionDef[],
  presence: "present" | "absent"
): number {
  // Create mock case state with simulated finding
  const mockCaseState: CaseState = {
    findings: [{
      findingId: finding.id,
      presence,
      value: undefined,
      daysSinceOnset: undefined
    }],
    completedActions: []
  };
  
  // Apply evidence to get updated beliefs
  const updatedBeliefs = applyEvidence(beliefs, mockCaseState, conditionDefs, []);
  
  // Calculate entropy of updated beliefs
  return calculateEntropy(updatedBeliefs);
}

/**
 * Estimate probability of positive test result
 * 
 * @param beliefs - Current belief state
 * @param conditionDefs - Condition definitions
 * @param testPerf - Test performance definition
 * @returns Estimated probability of positive test
 */
function estimateTestPositiveProbability(
  beliefs: Beliefs,
  conditionDefs: ConditionDef[],
  testPerf: TestPerformanceDef
): number {
  // This is a simplified estimation - in practice, you'd need to consider
  // which conditions the test is designed to detect
  let positiveProbability = 0;
  
  for (const [conditionId, probability] of Object.entries(beliefs)) {
    // Assume test has some base probability of being positive for each condition
    // This would be more sophisticated in practice
    positiveProbability += probability * 0.3; // Simplified assumption
  }
  
  return Math.min(1, Math.max(0, positiveProbability));
}
