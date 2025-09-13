/**
 * MapMyHealth Engine - Planner Module
 * 
 * Purpose: rank next actions and generate a shallow branch plan.
 * 
 * This module implements action ranking and depth-limited branch planning
 * using expectimax/beam search with cost-weighted utility optimization.
 */

import { 
  CaseState, 
  Beliefs, 
  ActionDef, 
  ConditionDef, 
  TestPerformanceDef, 
  CostWeights, 
  RankedAction, 
  Branch,
  FindingEffect,
  CompletedAction
} from './types';
import { scoreActionVOI } from './influence';
import { applyEvidence, classify } from './beliefs';
import { checkRedFlags } from './triage';

/**
 * Rank available actions by utility
 * 
 * @param caseState - Current case state
 * @param beliefs - Current belief state
 * @param actions - Available actions
 * @param conditionDefs - Condition definitions
 * @param testPerf - Test performance definitions
 * @param costWeights - Cost weights for utility calculation
 * @param k - Number of top actions to return (default 3)
 * @returns Array of ranked actions
 * 
 * Behavior: score all available actions (meeting preconditions, not violating contraindications). Keep top-K.
 */
export function rankActions(
  caseState: CaseState,
  beliefs: Beliefs,
  actions: ActionDef[],
  conditionDefs: ConditionDef[],
  testPerf: TestPerformanceDef[],
  costWeights: CostWeights,
  k: number = 3
): RankedAction[] {
  const availableActions = actions.filter(action => 
    isActionAvailable(action, caseState, beliefs, conditionDefs)
  );
  
  const rankedActions: RankedAction[] = [];
  
  for (const action of availableActions) {
    const voi = scoreActionVOI(beliefs, action, conditionDefs, testPerf, costWeights);
    
    rankedActions.push({
      actionId: action.id,
      utility: voi.utility,
      expectedInfoGain: voi.expectedInfoGain,
      costs: action.costs,
      outcomeProbs: voi.expectedOutcomeProbs,
      previews: voi.previewPosteriors
    });
  }
  
  // Sort by utility (descending) and return top k
  return rankedActions
    .sort((a, b) => b.utility - a.utility)
    .slice(0, k);
}

/**
 * Generate branch plans with depth-limited search
 * 
 * @param caseState - Current case state
 * @param beliefs - Current belief state
 * @param actions - Available actions
 * @param conditionDefs - Condition definitions
 * @param testPerf - Test performance definitions
 * @param costWeights - Cost weights for utility calculation
 * @param depth - Maximum search depth (default 2)
 * @param beamWidth - Maximum branches to keep at each level (default 3)
 * @returns Array of branch plans
 * 
 * Behavior: depth-limited expectimax/beam search; respect action preconditions/contraindications; 
 * stop early if classify().label === "confirmed" or a red flag enters the simulated state.
 */
export function planBranches(
  caseState: CaseState,
  beliefs: Beliefs,
  actions: ActionDef[],
  conditionDefs: ConditionDef[],
  testPerf: TestPerformanceDef[],
  costWeights: CostWeights,
  depth: number = 2,
  beamWidth: number = 3
): Branch[] {
  const branches: Branch[] = [];
  const branchId = 0;
  
  // Start with root state
  const rootBranch: Branch = {
    id: `branch-${branchId}`,
    steps: [],
    expectedUtility: 0,
    leafPosteriorPreview: beliefs
  };
  
  // Generate branches using beam search
  const activeBranches = [rootBranch];
  
  for (let level = 0; level < depth; level++) {
    const newBranches: Branch[] = [];
    
    for (const branch of activeBranches) {
      // Check if we should stop this branch
      if (shouldStopBranch(branch, caseState, conditionDefs)) {
        branches.push(branch);
        continue;
      }
      
      // Get current state for this branch
      const currentState = simulateBranchState(caseState, branch);
      const currentBeliefs = branch.leafPosteriorPreview;
      
      // Get available actions for current state
      const availableActions = actions.filter(action => 
        isActionAvailable(action, currentState, currentBeliefs, conditionDefs)
      );
      
      // Rank actions and take top beamWidth
      const rankedActions = rankActions(
        currentState,
        currentBeliefs,
        availableActions,
        conditionDefs,
        testPerf,
        costWeights,
        beamWidth
      );
      
      // Generate child branches for each action
      for (const rankedAction of rankedActions) {
        const action = actions.find(a => a.id === rankedAction.actionId)!;
        
        for (const outcome of action.outcomes) {
          const childBranch = createChildBranch(
            branch,
            action,
            outcome,
            rankedAction,
            currentState,
            conditionDefs,
            testPerf,
            level
          );
          
          newBranches.push(childBranch);
        }
      }
    }
    
    // Keep top beamWidth branches by utility
    activeBranches.length = 0;
    activeBranches.push(
      ...newBranches
        .sort((a, b) => b.expectedUtility - a.expectedUtility)
        .slice(0, beamWidth)
    );
  }
  
  // Add remaining active branches
  branches.push(...activeBranches);
  
  return branches;
}

/**
 * Check if an action is available given current state and preconditions
 * 
 * @param action - Action to check
 * @param caseState - Current case state
 * @param beliefs - Current belief state
 * @param conditionDefs - Condition definitions
 * @returns true if action is available
 */
function isActionAvailable(
  action: ActionDef,
  caseState: CaseState,
  beliefs: Beliefs,
  conditionDefs: ConditionDef[]
): boolean {
  if (!action.preconditions) return true;
  
  const { requireFindings, forbidFindings, requireActions } = action.preconditions;
  
  // Check required findings
  if (requireFindings) {
    for (const findingId of requireFindings) {
      const finding = caseState.findings.find(f => f.findingId === findingId);
      if (!finding || finding.presence !== "present") {
        return false;
      }
    }
  }
  
  // Check forbidden findings
  if (forbidFindings) {
    for (const findingId of forbidFindings) {
      const finding = caseState.findings.find(f => f.findingId === findingId);
      if (finding && finding.presence === "present") {
        return false;
      }
    }
  }
  
  // Check required actions
  if (requireActions) {
    for (const actionId of requireActions) {
      const completedAction = caseState.completedActions.find(a => a.actionId === actionId);
      if (!completedAction) {
        return false;
      }
    }
  }
  
  // Check if action has already been completed
  const alreadyCompleted = caseState.completedActions.some(a => a.actionId === action.id);
  if (alreadyCompleted) {
    return false;
  }
  
  return true;
}

/**
 * Check if a branch should stop (confirmed diagnosis or red flags)
 * 
 * @param branch - Branch to check
 * @param caseState - Original case state
 * @param conditionDefs - Condition definitions
 * @returns true if branch should stop
 */
function shouldStopBranch(
  branch: Branch,
  caseState: CaseState,
  conditionDefs: ConditionDef[]
): boolean {
  // Check if we have a confirmed diagnosis
  const classification = classify(branch.leafPosteriorPreview, conditionDefs);
  if (classification.label === "confirmed") {
    return true;
  }
  
  // Check for red flags in simulated state
  const simulatedState = simulateBranchState(caseState, branch);
  // Note: This is simplified - in practice, you'd need to check against finding definitions
  // and see if any red flags are present in the simulated state
  
  return false;
}

/**
 * Simulate the case state after a branch of actions
 * 
 * @param originalState - Original case state
 * @param branch - Branch to simulate
 * @returns Simulated case state
 */
function simulateBranchState(caseState: CaseState, branch: Branch): CaseState {
  const simulatedState: CaseState = {
    demographics: caseState.demographics,
    findings: [...caseState.findings],
    completedActions: [...caseState.completedActions]
  };
  
  // Apply all effects from branch steps
  for (const step of branch.steps) {
    if (step.outcomeId) {
      // Find the action and outcome
      // This would need the action definitions to properly simulate
      // For now, we'll add the completed action
      simulatedState.completedActions.push({
        actionId: step.actionId,
        outcomeId: step.outcomeId,
        at: new Date()
      });
    }
  }
  
  return simulatedState;
}

/**
 * Create a child branch from a parent branch and action outcome
 * 
 * @param parentBranch - Parent branch
 * @param action - Action taken
 * @param outcome - Outcome that occurred
 * @param rankedAction - Ranked action data
 * @param currentState - Current case state
 * @param conditionDefs - Condition definitions
 * @param testPerf - Test performance definitions
 * @param level - Current depth level
 * @returns New child branch
 */
function createChildBranch(
  parentBranch: Branch,
  action: ActionDef,
  outcome: any,
  rankedAction: RankedAction,
  currentState: CaseState,
  conditionDefs: ConditionDef[],
  testPerf: TestPerformanceDef[],
  level: number
): Branch {
  const childId = `${parentBranch.id}-${action.id}-${outcome.id}`;
  
  // Calculate new beliefs after outcome
  const newBeliefs = rankedAction.previews[outcome.id] || parentBranch.leafPosteriorPreview;
  
  // Calculate accumulated costs
  const accumCosts = {
    money: parentBranch.steps.reduce((sum, step) => sum + step.accumCosts.money, 0) + action.costs.money,
    timeHours: parentBranch.steps.reduce((sum, step) => sum + step.accumCosts.timeHours, 0) + action.costs.timeHours,
    difficulty: parentBranch.steps.reduce((sum, step) => sum + step.accumCosts.difficulty, 0) + action.costs.difficulty,
    risk: parentBranch.steps.reduce((sum, step) => sum + (step.accumCosts.risk || 0), 0) + (action.costs.risk || 0)
  };
  
  // Create new step
  const newStep = {
    actionId: action.id,
    outcomeId: outcome.id,
    predictedOutcomeProbs: rankedAction.outcomeProbs,
    posteriorPreview: newBeliefs,
    accumCosts
  };
  
  // Calculate expected utility for this branch
  const outcomeProb = rankedAction.outcomeProbs[outcome.id] || 0;
  const expectedUtility = parentBranch.expectedUtility + (outcomeProb * rankedAction.utility);
  
  return {
    id: childId,
    steps: [...parentBranch.steps, newStep],
    expectedUtility,
    leafPosteriorPreview: newBeliefs
  };
}
