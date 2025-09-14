#!/usr/bin/env ts-node

/**
 * MapMyHealth Engine Testing Script
 * 
 * Interactive turn-based testing script for the medical recommendation engine.
 * Allows users to input symptoms, see health states and action recommendations,
 * then execute actions to see how the state evolves.
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { buildView } from './src/engine/viewmodel';
import {
  ContentPack,
  CaseState,
  CostWeights,
  EngineInput,
  ViewModelOutput,
  FindingDef,
  ActionDef
} from './src/engine/types';

// Interface for readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Global state
let contentPack: ContentPack;
let caseState: CaseState;
let costWeights: CostWeights;

// Default cost weights
const DEFAULT_COST_WEIGHTS: CostWeights = {
  infoGainWeight: 1.0,
  money: 0.01,
  timeHours: 0.1,
  difficulty: 0.2,
  risk: 0.5
};

/**
 * Load content pack from JSON files
 */
async function loadContentPack(): Promise<ContentPack> {
  const contentDir = path.join(__dirname, 'src', 'content');
  
  const meta = JSON.parse(fs.readFileSync(path.join(contentDir, 'pack.meta.json'), 'utf8'));
  const findings = JSON.parse(fs.readFileSync(path.join(contentDir, 'findings.json'), 'utf8'));
  const conditions = JSON.parse(fs.readFileSync(path.join(contentDir, 'conditions.json'), 'utf8'));
  const actions = JSON.parse(fs.readFileSync(path.join(contentDir, 'actions.json'), 'utf8'));
  const testPerformance = JSON.parse(fs.readFileSync(path.join(contentDir, 'test_performance.json'), 'utf8'));
  
  return {
    meta,
    findings,
    conditions,
    actions,
    testPerformance
  };
}

/**
 * Initialize a new case
 */
function initializeCase(): CaseState {
  return {
    demographics: undefined,
    findings: [],
    completedActions: []
  };
}

/**
 * Display available symptoms for user selection
 */
function displayAvailableSymptoms(): void {
  console.log('\n' + '='.repeat(80));
  console.log('AVAILABLE SYMPTOMS & FINDINGS');
  console.log('='.repeat(80));
  
  // Group findings by kind
  const symptomFindings = contentPack.findings.filter(f => f.kind === 'symptom' && !f.isRedFlag);
  const historyFindings = contentPack.findings.filter(f => f.kind === 'history');
  const redFlagFindings = contentPack.findings.filter(f => f.isRedFlag);
  
  console.log('\n📋 SYMPTOMS:');
  symptomFindings.forEach((finding, index) => {
    console.log(`  ${index + 1}. ${finding.label} (${finding.id})`);
  });
  
  if (historyFindings.length > 0) {
    console.log('\n📅 HISTORY:');
    historyFindings.forEach((finding, index) => {
      console.log(`  ${symptomFindings.length + index + 1}. ${finding.label} (${finding.id})`);
    });
  }
  
  if (redFlagFindings.length > 0) {
    console.log('\n🚩 RED FLAGS:');
    redFlagFindings.forEach((finding, index) => {
      console.log(`  ${symptomFindings.length + historyFindings.length + index + 1}. ${finding.label} (${finding.id})`);
    });
  }
  
  console.log('\nEnter numbers separated by commas (e.g., 1,3,5) or finding IDs (e.g., sore_throat,fever)');
}

/**
 * Parse user input for symptoms
 */
function parseSymptomInput(input: string): string[] {
  const tokens = input.split(',').map(s => s.trim());
  const selectedIds: string[] = [];
  
  const allFindings = contentPack.findings.filter(f => f.kind === 'symptom' || f.kind === 'history');
  
  for (const token of tokens) {
    // Try parsing as number first
    const num = parseInt(token);
    if (!isNaN(num) && num >= 1 && num <= allFindings.length) {
      selectedIds.push(allFindings[num - 1].id);
    } else {
      // Try finding by ID
      const finding = allFindings.find(f => f.id === token);
      if (finding) {
        selectedIds.push(finding.id);
      }
    }
  }
  
  return selectedIds;
}

/**
 * Display current health state
 */
function displayHealthState(viewModel: ViewModelOutput): void {
  console.log('\n' + '='.repeat(80));
  console.log('HEALTH STATE');
  console.log('='.repeat(80));
  
  // Check for urgent flags
  if (viewModel.triage.urgent) {
    console.log('\n🚨 URGENT CARE NEEDED');
    console.log('Red flags detected:', viewModel.triage.flags?.join(', '));
    return;
  }
  
  // Current findings
  console.log('\n📋 CURRENT FINDINGS:');
  console.log('Present:');
  viewModel.topPanel.knownFindings.present.forEach(finding => {
    console.log(`  ✅ ${finding.label}`);
  });
  
  if (viewModel.topPanel.knownFindings.absent.length > 0) {
    console.log('Absent:');
    viewModel.topPanel.knownFindings.absent.forEach(finding => {
      console.log(`  ❌ ${finding.label}`);
    });
  }
  
  // Top conditions
  console.log('\n🏥 TOP CONDITIONS (likelihood):');
  viewModel.topPanel.rankedConditions.slice(0, 5).forEach((condition, index) => {
    const percentage = (condition.probability * 100).toFixed(1);
    const status = condition.statusLabel.toUpperCase();
    console.log(`  ${index + 1}. ${condition.label} - ${percentage}% [${status}]`);
  });
  
  // Recommendation
  console.log(`\n💡 RECOMMENDATION: ${viewModel.topPanel.recommendation.toUpperCase()}`);
  
  // Important unknowns
  if (viewModel.topPanel.mostInformativeUnknowns.length > 0) {
    console.log('\n❓ IMPORTANT UNKNOWN FINDINGS:');
    viewModel.topPanel.mostInformativeUnknowns.forEach((unknown, index) => {
      console.log(`  ${index + 1}. ${unknown.label} - ${unknown.rationale}`);
    });
  }
}

/**
 * Display action state with Mermaid graph and top actions
 */
function displayActionState(viewModel: ViewModelOutput): void {
  console.log('\n' + '='.repeat(80));
  console.log('ACTION STATE');
  console.log('='.repeat(80));
  
  if (viewModel.triage.urgent) {
    console.log('\n🚨 Seek urgent medical care immediately!');
    return;
  }
  
  // Top actions
  console.log('\n⚡ TOP RECOMMENDED ACTIONS:');
  viewModel.bottomPanel.actionRanking.slice(0, 3).forEach((action, index) => {
    console.log(`\n${index + 1}. ${action.label}`);
    console.log(`   📊 Info Gain: ${action.expectedInfoGain.toFixed(3)}`);
    console.log(`   💰 Cost: $${action.costs.money}, ⏱️  ${action.costs.timeHours}h, 🔧 Diff: ${action.costs.difficulty}`);
    console.log(`   🎯 Utility: ${action.utility.toFixed(3)}`);
  });
  
  // Mermaid action tree
  console.log('\n🌳 ACTION TREE (Mermaid format):');
  console.log('```mermaid');
  console.log('graph TD');
  
  const tree = viewModel.bottomPanel.actionTree;
  console.log(`    Root["${tree.root.label}"]`);
  
  tree.transitions.forEach((transition, actionIndex) => {
    const actionId = `Action${actionIndex}`;
    const actionLabel = transition.actionLabel.replace(/"/g, '\\"');
    console.log(`    Root --> ${actionId}["${actionLabel}"]`);
    
    transition.outcomes.forEach((outcome, outcomeIndex) => {
      const outcomeId = `${actionId}_Outcome${outcomeIndex}`;
      const outcomeLabel = `${outcome.label}\\n(${(outcome.probEstimate * 100).toFixed(1)}%)`;
      const stateLabel = outcome.to.label.replace(/"/g, '\\"');
      console.log(`    ${actionId} --> ${outcomeId}["${outcomeLabel}"]`);
      console.log(`    ${outcomeId} --> State${actionIndex}_${outcomeIndex}["${stateLabel}"]`);
    });
  });
  
  console.log('```');
}

/**
 * Get user's action choice
 */
function askUserAction(viewModel: ViewModelOutput): Promise<string> {
  return new Promise((resolve) => {
    console.log('\n' + '='.repeat(80));
    console.log('CHOOSE AN ACTION');
    console.log('='.repeat(80));
    
    const actions = viewModel.bottomPanel.actionRanking;
    console.log('\nAvailable actions:');
    actions.forEach((action, index) => {
      console.log(`${index + 1}. ${action.label}`);
    });
    console.log(`${actions.length + 1}. Exit simulation`);

    rl.question('\nEnter action number (1-' + (actions.length + 1) + ') or action ID: ', resolve);
  });
}

/**
 * Get user's outcome choice for an action
 */
function askUserOutcome(actionId: string, viewModel: ViewModelOutput): Promise<string> {
  return new Promise((resolve) => {
    console.log('\n' + '='.repeat(80));
    console.log('CHOOSE OUTCOME');
    console.log('='.repeat(80));
    
    const transition = viewModel.bottomPanel.actionTree.transitions.find((t: any) =>
      t.actionId === actionId ||
      viewModel.bottomPanel.actionRanking.find((a: any) => a.actionId === actionId)?.label === t.actionLabel
    );
    
    if (!transition) {
      console.log('Action not found in tree!');
      resolve('');
      return;
    }
    
    console.log(`\nOutcomes for "${transition.actionLabel}":`);
    transition.outcomes.forEach((outcome, index) => {
      const prob = (outcome.probEstimate * 100).toFixed(1);
      console.log(`${index + 1}. ${outcome.label} (${prob}% chance)`);
    });
    
    rl.question('\nEnter outcome number: ', resolve);
  });
}

/**
 * Apply action outcome to case state
 */
function applyActionOutcome(actionId: string, outcomeId: string): void {
  const action = contentPack.actions.find(a => a.id === actionId);
  if (!action) {
    console.log('❌ Action not found!');
    return;
  }
  
  const outcome = action.outcomes.find(o => o.id === outcomeId);
  if (!outcome) {
    console.log('❌ Outcome not found!');
    return;
  }
  
  // Add completed action
  caseState.completedActions.push({
    actionId,
    outcomeId,
    at: new Date()
  });
  
  // Apply finding effects
  outcome.effects.forEach(effect => {
    const existingFinding = caseState.findings.find(f => f.findingId === effect.findingId);
    if (existingFinding) {
      existingFinding.presence = effect.presence;
      if (effect.value !== undefined) existingFinding.value = effect.value;
      if (effect.daysSinceOnset !== undefined) existingFinding.daysSinceOnset = effect.daysSinceOnset;
    } else {
      caseState.findings.push({
        findingId: effect.findingId,
        presence: effect.presence,
        value: effect.value,
        daysSinceOnset: effect.daysSinceOnset
      });
    }
  });
  
  console.log(`\n✅ Applied outcome: ${outcome.label}`);
}


/**
 * Main game loop
 */
async function gameLoop(): Promise<void> {
  while (true) {
    // Build current view model
    const engineInput: EngineInput = {
      caseState,
      contentPack,
      userCostWeights: costWeights
    };
    
    const viewModel = buildView(engineInput);
    
    // Display current state
    displayHealthState(viewModel);
    displayActionState(viewModel);
    
    // Check if urgent - stop game loop
    if (viewModel.triage.urgent) {
      console.log('\n🏥 Game ended due to urgent care requirement.');
      break;
    }
    
    // Check if no actions available
    if (viewModel.bottomPanel.actionRanking.length === 0) {
      console.log('\n✅ No more actions available. Case complete.');
      break;
    }
    
    // Get user action choice
    const actionChoice = await askUserAction(viewModel);
    if (!actionChoice.trim()) break;

    // Parse action choice
    const actionNum = parseInt(actionChoice);

    // Check for exit option
    if (!isNaN(actionNum) && actionNum === viewModel.bottomPanel.actionRanking.length + 1) {
      console.log('\n👋 Exiting simulation...');
      break;
    }

    let selectedActionId: string;
    if (!isNaN(actionNum) && actionNum >= 1 && actionNum <= viewModel.bottomPanel.actionRanking.length) {
      selectedActionId = viewModel.bottomPanel.actionRanking[actionNum - 1].actionId;
    } else {
      selectedActionId = actionChoice.trim();
    }
    
    // Get outcome choice
    const outcomeChoice = await askUserOutcome(selectedActionId, viewModel);
    if (!outcomeChoice.trim()) break;
    
    const outcomeNum = parseInt(outcomeChoice);
    const transition = viewModel.bottomPanel.actionTree.transitions.find((t: any) =>
      t.actionId === selectedActionId ||
      viewModel.bottomPanel.actionRanking.find((a: any) => a.actionId === selectedActionId)?.label === t.actionLabel
    );
    
    if (!transition || !transition.outcomes[outcomeNum - 1]) {
      console.log('❌ Invalid outcome choice!');
      continue;
    }
    
    const selectedOutcome = transition.outcomes[outcomeNum - 1];
    
    // Apply outcome
    applyActionOutcome(selectedActionId, selectedOutcome.outcomeId);

    console.log('\n' + '='.repeat(80));
    console.log('📈 OUTCOME APPLIED - UPDATING ANALYSIS...');
    console.log('='.repeat(80));

    // Loop will continue automatically to show updated state
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('🏥 MapMyHealth Engine Testing Script');
  console.log('====================================\n');
  
  try {
    // Load content pack
    console.log('Loading content pack...');
    contentPack = await loadContentPack();
    console.log(`✅ Loaded content pack: ${contentPack.meta.name} v${contentPack.meta.version}`);
    
    // Initialize case
    caseState = initializeCase();
    costWeights = DEFAULT_COST_WEIGHTS;
    
    // Get initial symptoms
    displayAvailableSymptoms();
    
    const symptomInput = await new Promise<string>((resolve) => {
      rl.question('\nEnter your symptoms: ', resolve);
    });
    
    if (symptomInput.trim()) {
      const selectedSymptoms = parseSymptomInput(symptomInput);
      console.log(`\n✅ Selected symptoms: ${selectedSymptoms.join(', ')}`);
      
      // Add symptoms to case state
      selectedSymptoms.forEach(symptomId => {
        caseState.findings.push({
          findingId: symptomId,
          presence: 'present'
        });
      });
    }
    
    // Start game loop
    await gameLoop();
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    rl.close();
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}