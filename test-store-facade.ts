#!/usr/bin/env ts-node

/**
 * MapMyHealth Store and Facade Smoke Tests
 *
 * Basic integration tests to verify the health store and engine facade work correctly.
 * Tests the complete flow from adding findings to getting engine outputs.
 */

// Import facade creation function that works in Node.js
import { createEngineFacadeNode } from './src/engine/facade-node';
import { PatientHealthService, getAvailableMockPatients } from './src/app/services/PatientHealthService';
import type { KnownFinding, EngineInputs } from './src/engine/facade';

// Colors for test output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTest(name: string, passed: boolean, details?: string) {
  const icon = passed ? '✅' : '❌';
  const color = passed ? colors.green : colors.red;
  log(`${icon} ${name}`, color);
  if (details) {
    log(`   ${details}`, colors.blue);
  }
}

async function runTests() {
  log('\n🧪 MapMyHealth Store & Facade Smoke Tests', colors.bold);
  log('='.repeat(60), colors.blue);

  let totalTests = 0;
  let passedTests = 0;

  // Test 1: Engine Facade Creation
  totalTests++;
  log('\n🔧 Test 1: Engine Facade Creation', colors.yellow);
  try {
    const facade = await createEngineFacadeNode();
    const hasEvaluate = typeof facade.evaluate === 'function';
    const hasGetConditionGraph = typeof facade.getConditionGraph === 'function';
    const hasGetActionOutcomes = typeof facade.getActionOutcomes === 'function';

    const passed = hasEvaluate && hasGetConditionGraph && hasGetActionOutcomes;
    logTest('Engine facade created with required methods', passed);
    if (passed) passedTests++;
  } catch (error) {
    logTest('Engine facade creation failed', false, `Error: ${error}`);
  }

  // Test 2: PatientHealthService
  totalTests++;
  log('\n👤 Test 2: PatientHealthService', colors.yellow);
  try {
    const mockPatients = getAvailableMockPatients();
    const hasMockData = mockPatients.length > 0;
    logTest('Mock patients available', hasMockData, `Found ${mockPatients.length} patients`);

    const patientData = await PatientHealthService.fetch('patient-001');
    const hasPatientData = patientData && patientData.demographics;
    logTest('Patient data fetch works', !!hasPatientData);

    const passed = hasMockData && hasPatientData;
    if (passed) passedTests++;
  } catch (error) {
    logTest('PatientHealthService failed', false, `Error: ${error}`);
  }

  // Test 3: Engine Evaluation with Empty Input
  totalTests++;
  log('\n⚙️  Test 3: Engine Evaluation (Empty Input)', colors.yellow);
  try {
    const facade = await createEngineFacadeNode();
    const emptyInput: EngineInputs = {
      knownFindings: [],
      patientData: null
    };

    const result = await facade.evaluate(emptyInput);
    const hasRequiredFields = result &&
                             Array.isArray(result.rankedConditions) &&
                             Array.isArray(result.importantUnknowns) &&
                             Array.isArray(result.actionRanking) &&
                             result.actionMap &&
                             typeof result.triage === 'object';

    logTest('Empty input evaluation succeeds', hasRequiredFields);
    if (hasRequiredFields) passedTests++;
  } catch (error) {
    logTest('Empty input evaluation failed', false, `Error: ${error}`);
  }

  // Test 4: Engine Evaluation with Findings
  totalTests++;
  log('\n🩺 Test 4: Engine Evaluation (With Findings)', colors.yellow);
  try {
    const facade = await createEngineFacadeNode();
    const findings: KnownFinding[] = [
      { id: 'sore_throat', presence: 'present', source: 'user' },
      { id: 'fever', presence: 'present', source: 'user' }
    ];

    const input: EngineInputs = {
      knownFindings: findings,
      patientData: null
    };

    const result = await facade.evaluate(input);
    const hasConditions = result.rankedConditions.length > 0;
    const hasActions = result.actionRanking.length > 0;
    const hasValidProbabilities = result.rankedConditions.every(c =>
      c.score >= 0 && c.score <= 1
    );

    logTest('Findings input evaluation succeeds', true);
    logTest('Generated condition rankings', hasConditions,
           `Found ${result.rankedConditions.length} conditions`);
    logTest('Generated action rankings', hasActions,
           `Found ${result.actionRanking.length} actions`);
    logTest('Valid probability scores', hasValidProbabilities);

    const passed = hasConditions && hasActions && hasValidProbabilities;
    if (passed) passedTests++;
  } catch (error) {
    logTest('Findings input evaluation failed', false, `Error: ${error}`);
  }

  // Test 5: getConditionGraph
  totalTests++;
  log('\n🔍 Test 5: Condition Graph Retrieval', colors.yellow);
  try {
    const facade = await createEngineFacadeNode();
    const conditionGraph = await facade.getConditionGraph('viral_pharyngitis');

    const hasCondition = conditionGraph && conditionGraph.condition;
    const hasRelatedFindings = Array.isArray(conditionGraph.relatedFindings);
    const hasRelatedActions = Array.isArray(conditionGraph.relatedActions);

    logTest('Condition graph retrieved', hasCondition);
    logTest('Has related findings', hasRelatedFindings,
           `Found ${conditionGraph?.relatedFindings?.length || 0} findings`);
    logTest('Has related actions', hasRelatedActions,
           `Found ${conditionGraph?.relatedActions?.length || 0} actions`);

    const passed = hasCondition && hasRelatedFindings && hasRelatedActions;
    if (passed) passedTests++;
  } catch (error) {
    logTest('Condition graph retrieval failed', false, `Error: ${error}`);
  }

  // Test 6: getActionOutcomes
  totalTests++;
  log('\n🎯 Test 6: Action Outcomes Retrieval', colors.yellow);
  try {
    const facade = await createEngineFacadeNode();
    const outcomes = await facade.getActionOutcomes('rapid_strep_test');

    const hasOutcomes = Array.isArray(outcomes) && outcomes.length > 0;
    const hasValidStructure = outcomes.every(o =>
      o.outcomeId && o.label && typeof o.probEstimate === 'number'
    );

    logTest('Action outcomes retrieved', hasOutcomes,
           `Found ${outcomes.length} outcomes`);
    logTest('Valid outcome structure', hasValidStructure);

    const passed = hasOutcomes && hasValidStructure;
    if (passed) passedTests++;
  } catch (error) {
    logTest('Action outcomes retrieval failed', false, `Error: ${error}`);
  }

  // Test 7: Red Flag Detection
  totalTests++;
  log('\n🚩 Test 7: Red Flag Detection', colors.yellow);
  try {
    const facade = await createEngineFacadeNode();
    const findings: KnownFinding[] = [
      { id: 'drooling', presence: 'present', source: 'user' }, // This is a red flag
      { id: 'sore_throat', presence: 'present', source: 'user' }
    ];

    const input: EngineInputs = {
      knownFindings: findings,
      patientData: null
    };

    const result = await facade.evaluate(input);
    const isUrgent = result.triage.urgent;
    const hasFlags = result.triage.flags && result.triage.flags.length > 0;

    logTest('Red flag detection works', !!(isUrgent && hasFlags),
           `Urgent: ${isUrgent}, Flags: ${result.triage.flags?.join(', ') || 'none'}`);

    if (isUrgent && hasFlags) passedTests++;
  } catch (error) {
    logTest('Red flag detection failed', false, `Error: ${error}`);
  }

  // Summary
  log('\n📊 Test Summary', colors.bold);
  log('='.repeat(60), colors.blue);
  log(`Total Tests: ${totalTests}`);
  log(`Passed: ${passedTests}`, passedTests === totalTests ? colors.green : colors.yellow);
  log(`Failed: ${totalTests - passedTests}`, totalTests - passedTests === 0 ? colors.green : colors.red);

  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  log(`Success Rate: ${successRate}%`, passedTests === totalTests ? colors.green : colors.yellow);

  if (passedTests === totalTests) {
    log('\n🎉 All tests passed! Engine facade and store are ready.', colors.green);
  } else {
    log('\n⚠️  Some tests failed. Check the issues above.', colors.yellow);
  }

  return passedTests === totalTests;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}

export { runTests };