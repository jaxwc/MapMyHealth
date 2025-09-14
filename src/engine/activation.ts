/**
 * MapMyHealth Engine - Activation Module
 *
 * Purpose: Filter conditions based on context-aware activation rules.
 *
 * This module implements condition activation based on present symptoms and their categories,
 * reducing computational load and improving diagnostic focus by only considering relevant conditions.
 */

import { CaseState, ConditionDef, FindingDef } from './types';

/**
 * Filter conditions based on activation rules and symptom contexts
 *
 * @param caseState - Current case state with findings
 * @param conditionDefs - All available condition definitions
 * @param findingDefs - Finding definitions with categories
 * @returns Array of conditions that should be activated for this case
 */
export function filterActiveConditions(
  caseState: CaseState,
  conditionDefs: ConditionDef[],
  findingDefs: FindingDef[]
): ConditionDef[] {
  // Get all present findings
  const presentFindings = caseState.findings
    .filter(f => f.presence === 'present')
    .map(f => f.findingId);

  if (presentFindings.length === 0) {
    // If no symptoms present, return all conditions (initial state)
    return conditionDefs;
  }

  // Create finding lookup for categories
  const findingLookup = new Map<string, FindingDef>();
  findingDefs.forEach(f => findingLookup.set(f.id, f));

  // Get categories from present findings
  const presentCategories = new Set<string>();
  presentFindings.forEach(findingId => {
    const finding = findingLookup.get(findingId);
    if (finding?.categories) {
      finding.categories.forEach(cat => presentCategories.add(cat));
    }
  });

  return conditionDefs.filter(condition =>
    shouldActivateCondition(condition, presentFindings, presentCategories)
  );
}

/**
 * Determine if a condition should be activated based on current evidence
 *
 * @param condition - Condition definition to evaluate
 * @param presentFindings - Array of present finding IDs
 * @param presentCategories - Set of categories from present findings
 * @returns True if condition should be activated
 */
function shouldActivateCondition(
  condition: ConditionDef,
  presentFindings: string[],
  presentCategories: Set<string>
): boolean {
  // If condition has no activation rules, always activate (backward compatibility)
  if (!condition.activationRules && !condition.contexts) {
    return true;
  }

  // Check activation rules first (most specific)
  if (condition.activationRules) {
    // RequireAny rule: at least one of the required findings must be present
    if (condition.activationRules.requireAny) {
      const hasRequiredFinding = condition.activationRules.requireAny.some(
        requiredId => presentFindings.includes(requiredId)
      );
      if (hasRequiredFinding) {
        return true;
      }
    }

    // RequireAll rule: all required findings must be present
    if (condition.activationRules.requireAll) {
      const hasAllRequiredFindings = condition.activationRules.requireAll.every(
        requiredId => presentFindings.includes(requiredId)
      );
      if (hasAllRequiredFindings) {
        return true;
      }
    }
  }

  // Check context categories (broader activation)
  if (condition.contexts) {
    const hasMatchingContext = condition.contexts.some(
      context => presentCategories.has(context)
    );
    if (hasMatchingContext) {
      return true;
    }
  }

  // No activation criteria met
  return false;
}

/**
 * Get activation summary for debugging/logging
 *
 * @param caseState - Current case state
 * @param allConditions - All available conditions
 * @param activeConditions - Filtered active conditions
 * @param findingDefs - Finding definitions
 * @returns Summary object with activation statistics
 */
export function getActivationSummary(
  caseState: CaseState,
  allConditions: ConditionDef[],
  activeConditions: ConditionDef[],
  findingDefs: FindingDef[]
) {
  const presentFindings = caseState.findings
    .filter(f => f.presence === 'present')
    .map(f => f.findingId);

  const findingLookup = new Map<string, FindingDef>();
  findingDefs.forEach(f => findingLookup.set(f.id, f));

  const presentCategories = new Set<string>();
  presentFindings.forEach(findingId => {
    const finding = findingLookup.get(findingId);
    if (finding?.categories) {
      finding.categories.forEach(cat => presentCategories.add(cat));
    }
  });

  return {
    totalConditions: allConditions.length,
    activeConditions: activeConditions.length,
    reductionRatio: (allConditions.length - activeConditions.length) / allConditions.length,
    presentFindings: presentFindings.length,
    presentCategories: Array.from(presentCategories),
    activatedBy: {
      rules: activeConditions.filter(c => c.activationRules).length,
      contexts: activeConditions.filter(c => c.contexts && !c.activationRules).length,
      noRules: activeConditions.filter(c => !c.activationRules && !c.contexts).length
    }
  };
}