/**
 * MapMyHealth Engine - Beliefs Module
 * 
 * Purpose: compute condition probabilities from priors and current evidence.
 * 
 * This module implements Bayesian belief updating using likelihood ratios
 * and handles normalization, demographic priors, and time-dependent test performance.
 */

import {
  CaseState,
  ConditionDef,
  TestPerformanceDef,
  Beliefs,
  Classification,
  Recommendation,
  Demographics
} from './types';

/**
 * Seed prior probabilities based on demographics and condition definitions
 * 
 * @param caseState - Current case state with demographics
 * @param conditionDefs - Array of condition definitions with priors
 * @returns Normalized prior probabilities
 * 
 * Behavior: returns normalized prior probabilities (use demographics if available; else default)
 */
export function seedPriors(caseState: CaseState, conditionDefs: ConditionDef[]): Beliefs {
  const beliefs: Beliefs = {};
  const demographics = caseState.demographics;
  
  // Calculate priors for each condition
  for (const condition of conditionDefs) {
    let prior = condition.priors.default;
    
    // Apply demographic adjustments if available
    if (demographics && condition.priors.byDemo) {
      for (const demoRule of condition.priors.byDemo) {
        if (matchesDemographics(demographics, demoRule)) {
          prior = demoRule.prior;
          break; // Use first matching rule
        }
      }
    }
    
    beliefs[condition.id] = prior;
  }
  
  // Normalize to ensure probabilities sum to 1
  return normalizeBeliefs(beliefs);
}

/**
 * Apply evidence to update beliefs using likelihood ratios
 * 
 * @param beliefs - Current belief state
 * @param caseState - Case state with findings
 * @param conditionDefs - Condition definitions with LR tables
 * @param testPerf - Test performance definitions
 * @returns Updated beliefs after applying evidence
 * 
 * Behavior:
 * - For each finding (or bucket) with present/absent, update target condition odds with LR+ / LR−
 * - Unknown findings are skipped
 * - Apply bucket logic: at most one LR per bucket per condition per pass
 * - Apply time-dependent test performance if daysSinceOnset falls into a piecewise band
 * - Normalize at end to sum to 1 (guard against zeros)
 */
export function applyEvidence(
  beliefs: Beliefs,
  caseState: CaseState,
  conditionDefs: ConditionDef[],
  testPerf: TestPerformanceDef[]
): Beliefs {
  const updatedBeliefs = { ...beliefs };
  
  // Create lookup for test performance
  const testPerfMap = new Map<string, TestPerformanceDef>();
  testPerf.forEach(tp => testPerfMap.set(tp.id, tp));
  
  // Apply evidence for each condition
  for (const condition of conditionDefs) {
    const conditionId = condition.id;
    let odds = updatedBeliefs[conditionId] / (1 - updatedBeliefs[conditionId]);
    
    // Track which buckets have been applied to avoid double-counting
    const appliedBuckets = new Set<string>();
    
    // Apply each LR rule in the condition's LR table
    for (const lrRule of condition.lrTable) {
      const finding = caseState.findings.find(f => f.findingId === lrRule.target);
      
      if (!finding) continue;
      
      // Skip unknown findings
      if (finding.presence === "unknown") continue;
      
      // Apply bucket logic - only apply one LR per bucket per condition
      if (appliedBuckets.has(lrRule.target)) continue;
      appliedBuckets.add(lrRule.target);
      
      // Get likelihood ratio based on finding presence
      let lr = finding.presence === "present" ? lrRule.LRpos : lrRule.LRneg;
      
      // Apply time-dependent test performance if this is a test finding
      if (finding.presence === "present" || finding.presence === "absent") {
        if (finding.daysSinceOnset !== undefined) {
        const testPerfDef = testPerfMap.get(lrRule.target);
        if (testPerfDef?.piecewiseByDaysSinceOnset) {
          const adjustedPerf = getPiecewisePerformance(
            testPerfDef, 
            finding.daysSinceOnset
          );
          
          // Adjust LR based on test performance
          if (finding.presence === "present") {
            lr = (adjustedPerf.sensitivity / (1 - adjustedPerf.specificity));
          } else {
            lr = ((1 - adjustedPerf.sensitivity) / adjustedPerf.specificity);
          }
        }
        }
      }

      // Update odds
      odds *= lr;
    }
    
    // Convert back to probability
    updatedBeliefs[conditionId] = odds / (1 + odds);
  }
  
  // Normalize to ensure probabilities sum to 1
  return normalizeBeliefs(updatedBeliefs);
}

/**
 * Classify beliefs into discrete clinical states
 * 
 * @param beliefs - Current belief state
 * @param conditionDefs - Condition definitions with thresholds
 * @returns Classification with top conditions, label, and recommendation
 * 
 * Behavior: determine user-facing state using per-condition thresholds and lead delta
 */
export function classify(beliefs: Beliefs, conditionDefs: ConditionDef[]): Classification {
  // Sort conditions by probability (descending)
  const sortedConditions = Object.entries(beliefs)
    .map(([conditionId, probability]) => [conditionId, probability] as [string, number])
    .sort((a, b) => b[1] - a[1]);
  
  if (sortedConditions.length === 0) {
    return {
      top: [],
      label: "unknown" as "highly-likely" | "likely" | "unknown" | "not-likely" | "very-unlikely",
      recommendation: "watchful-waiting"
    };
  }
  
  const [topConditionId, topProbability] = sortedConditions[0];
  const topCondition = conditionDefs.find(c => c.id === topConditionId);
  
  if (!topCondition) {
    return {
      top: sortedConditions.slice(0, 3),
      label: "unknown" as "highly-likely" | "likely" | "unknown" | "not-likely" | "very-unlikely",
      recommendation: "watchful-waiting"
    };
  }
  
  // Determine classification based on probability bands
  let label: "highly-likely" | "likely" | "unknown" | "not-likely" | "very-unlikely" = "unknown";
  let recommendation: Recommendation = "watchful-waiting";

  const matchingBand = topCondition.probabilityBands.find(b => topProbability >= b.minInclusive && topProbability < b.maxExclusive);
  if (matchingBand) {
    label = matchingBand.category;
    // Use simple recommendation mapping since recommendationsByBand doesn't exist
    if (label === "highly-likely") recommendation = "targeted-care";
    else if (label === "likely") recommendation = "supportive-care";
    else recommendation = "watchful-waiting";
  }
  
  return {
    top: sortedConditions.slice(0, 5), // Top 5 conditions
    label,
    recommendation
  };
}

/**
 * Normalize beliefs to ensure they sum to 1
 * 
 * @param beliefs - Belief state to normalize
 * @returns Normalized beliefs
 */
function normalizeBeliefs(beliefs: Beliefs): Beliefs {
  const sum = Object.values(beliefs).reduce((acc, prob) => acc + prob, 0);
  
  if (sum === 0) {
    // If all probabilities are zero, distribute equally
    const conditionCount = Object.keys(beliefs).length;
    const equalProb = conditionCount > 0 ? 1 / conditionCount : 0;
    
    const normalized: Beliefs = {};
    for (const conditionId of Object.keys(beliefs)) {
      normalized[conditionId] = equalProb;
    }
    return normalized;
  }
  
  // Normalize by dividing by sum
  const normalized: Beliefs = {};
  for (const [conditionId, prob] of Object.entries(beliefs)) {
    normalized[conditionId] = prob / sum;
  }
  
  return normalized;
}

/**
 * Check if demographics match a demographic rule
 * 
 * @param demographics - Current demographics
 * @param rule - Demographic rule to match against
 * @returns true if demographics match the rule
 */
function matchesDemographics(demographics: Demographics, rule: any): boolean {
  // Check age range
  if (rule.ageRange && demographics.age !== undefined) {
    const { min, max } = rule.ageRange;
    if (min !== undefined && demographics.age < min) return false;
    if (max !== undefined && demographics.age > max) return false;
  }
  
  // Check sex at birth
  if (rule.sexAtBirth && demographics.sexAtBirth !== rule.sexAtBirth) {
    return false;
  }
  
  // Check season (would need to be calculated from current date)
  // For now, skip season matching as it requires date context
  
  return true;
}

/**
 * Get piecewise test performance based on days since onset
 * 
 * @param testPerf - Test performance definition
 * @param daysSinceOnset - Days since onset
 * @returns Adjusted sensitivity and specificity
 */
function getPiecewisePerformance(
  testPerf: TestPerformanceDef,
  daysSinceOnset: number
): { sensitivity: number; specificity: number } {
  if (!testPerf.piecewiseByDaysSinceOnset) {
    return {
      sensitivity: testPerf.sensitivity,
      specificity: testPerf.specificity
    };
  }
  
  // Find matching time band
  for (const band of testPerf.piecewiseByDaysSinceOnset) {
    const { min, max } = band.daysRange;
    if ((min === undefined || daysSinceOnset >= min) && 
        (max === undefined || daysSinceOnset <= max)) {
      return {
        sensitivity: band.sensitivity,
        specificity: band.specificity
      };
    }
  }
  
  // Fall back to default performance
  return {
    sensitivity: testPerf.sensitivity,
    specificity: testPerf.specificity
  };
}
