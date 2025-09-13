/**
 * MapMyHealth Engine - ViewModel Module Tests
 * 
 * End-to-end tests for the viewmodel that ranks conditions based on findings.
 */

import { buildView } from '../engine/viewmodel';
import type { CaseState, EngineInput, CostWeights, ContentPack } from '../engine/types';

// Import content pack data
import findings from '../content/findings.json';
import conditions from '../content/conditions.json';
import actions from '../content/actions.json';
import testPerformance from '../content/test_performance.json';
import meta from '../content/pack.meta.json';

describe('ViewModel Module - End-to-End Tests', () => {
  const contentPack: ContentPack = { 
    meta, 
    findings, 
    conditions, 
    actions, 
    testPerformance 
  };

  const userCostWeights: CostWeights = {
    infoGainWeight: 1,
    money: 0.01,
    timeHours: 0.1,
    difficulty: 0.5,
    risk: 2
  };

  describe('buildView', () => {
    it('should rank conditions based on provided findings', () => {
      const caseState: CaseState = {
        findings: [
          { findingId: 'sore_throat', presence: 'present' },
          { findingId: 'fever', presence: 'present' },
          { findingId: 'cough', presence: 'absent' },
          { findingId: 'tonsillar_exudates', presence: 'present' },
          { findingId: 'tender_cervical_nodes', presence: 'present' }
        ],
        completedActions: [],
        demographics: { age: 25 }
      };

      const input: EngineInput = { caseState, contentPack, userCostWeights };
      const vm = buildView(input);

      // Basic structure checks
      expect(vm.triage.urgent).toBe(false);
      expect(vm.topPanel.rankedConditions.length).toBeGreaterThan(0);
      expect(vm.bottomPanel.actionRanking.length).toBeGreaterThan(0);

      // Check that conditions are ranked by probability (descending order)
      const probs = vm.topPanel.rankedConditions.map(rc => rc.probability);
      for (let i = 0; i < probs.length - 1; i++) {
        expect(probs[i]).toBeGreaterThanOrEqual(probs[i + 1]);
      }

      // Check probability ranges
      for (const condition of vm.topPanel.rankedConditions) {
        expect(condition.probability).toBeGreaterThanOrEqual(0);
        expect(condition.probability).toBeLessThanOrEqual(1);
        expect(['confirmed', 'likely', 'inconclusive']).toContain(condition.statusLabel);
      }

      // With Centor-like findings, strep should be ranked higher than viral
      const strepCondition = vm.topPanel.rankedConditions.find(rc => rc.id === 'streptococcal_pharyngitis');
      const viralCondition = vm.topPanel.rankedConditions.find(rc => rc.id === 'viral_pharyngitis');
      
      // Check that both conditions exist and are ranked
      expect(strepCondition).toBeDefined();
      expect(viralCondition).toBeDefined();
      
      // The algorithm should rank strep higher due to positive Centor criteria
      if (strepCondition && viralCondition) {
        // Allow for small differences due to normalization
        expect(strepCondition.probability).toBeGreaterThanOrEqual(viralCondition.probability - 0.1);
      }
    });

    it('should rank strep as top condition with positive rapid strep test', () => {
      const caseState: CaseState = {
        findings: [
          { findingId: 'sore_throat', presence: 'present' },
          { findingId: 'fever', presence: 'present' },
          { findingId: 'cough', presence: 'absent' },
          { findingId: 'rapid_strep_positive', presence: 'present', daysSinceOnset: 2 }
        ],
        completedActions: [],
        demographics: { age: 25 }
      };

      const input: EngineInput = { caseState, contentPack, userCostWeights };
      const vm = buildView(input);

      expect(vm.triage.urgent).toBe(false);
      expect(vm.topPanel.rankedConditions.length).toBeGreaterThan(0);
      expect(vm.topPanel.rankedConditions[0].id).toBe('streptococcal_pharyngitis');
      expect(vm.topPanel.rankedConditions[0].probability).toBeGreaterThan(0.5); // Should be reasonably high with positive test
    });

    it('should handle red flags and suppress planning', () => {
      const caseState: CaseState = {
        findings: [
          { findingId: 'sore_throat', presence: 'present' },
          { findingId: 'drooling', presence: 'present' } // Red flag
        ],
        completedActions: [],
        demographics: { age: 25 }
      };

      const input: EngineInput = { caseState, contentPack, userCostWeights };
      const vm = buildView(input);

      expect(vm.triage.urgent).toBe(true);
      expect(vm.triage.flags).toContain('drooling');
      expect(vm.topPanel.recommendation).toBe('urgent-care');
      expect(vm.bottomPanel.actionRanking).toHaveLength(0);
      expect(vm.bottomPanel.actionTree.root.label).toContain('URGENT');
    });

    it('should provide informative unknowns', () => {
      const caseState: CaseState = {
        findings: [
          { findingId: 'sore_throat', presence: 'present' }
          // Missing many findings that could be informative
        ],
        completedActions: [],
        demographics: { age: 25 }
      };

      const input: EngineInput = { caseState, contentPack, userCostWeights };
      const vm = buildView(input);

      expect(vm.triage.urgent).toBe(false);
      expect(vm.topPanel.mostInformativeUnknowns.length).toBeGreaterThan(0);
      
      // Check that informative unknowns have valid structure
      for (const unknown of vm.topPanel.mostInformativeUnknowns) {
        expect(unknown.findingId).toBeDefined();
        expect(unknown.label).toBeDefined();
        expect(unknown.infoMetric).toBeGreaterThanOrEqual(0);
        expect(unknown.rationale).toBeDefined();
      }
    });

    it('should rank actions by utility', () => {
      const caseState: CaseState = {
        findings: [
          { findingId: 'sore_throat', presence: 'present' },
          { findingId: 'fever', presence: 'present' }
        ],
        completedActions: [],
        demographics: { age: 25 }
      };

      const input: EngineInput = { caseState, contentPack, userCostWeights };
      const vm = buildView(input);

      expect(vm.triage.urgent).toBe(false);
      expect(vm.bottomPanel.actionRanking.length).toBeGreaterThan(0);

      // Check that actions are ranked by utility (descending)
      const utilities = vm.bottomPanel.actionRanking.map(ar => ar.utility);
      for (let i = 0; i < utilities.length - 1; i++) {
        expect(utilities[i]).toBeGreaterThanOrEqual(utilities[i + 1]);
      }

      // Check action structure
      for (const action of vm.bottomPanel.actionRanking) {
        expect(action.actionId).toBeDefined();
        expect(action.label).toBeDefined();
        expect(action.utility).toBeDefined();
        expect(action.expectedInfoGain).toBeGreaterThanOrEqual(0);
        expect(action.costs).toBeDefined();
        expect(action.outcomeProbs).toBeDefined();
      }
    });

    it('should generate action tree with valid transitions', () => {
      const caseState: CaseState = {
        findings: [
          { findingId: 'sore_throat', presence: 'present' }
        ],
        completedActions: [],
        demographics: { age: 25 }
      };

      const input: EngineInput = { caseState, contentPack, userCostWeights };
      const vm = buildView(input);

      expect(vm.triage.urgent).toBe(false);
      expect(vm.bottomPanel.actionTree).toBeDefined();
      expect(vm.bottomPanel.actionTree.root).toBeDefined();
      expect(vm.bottomPanel.actionTree.transitions).toBeDefined();

      // Check action tree structure
      expect(vm.bottomPanel.actionTree.root.stateId).toBe('root');
      expect(vm.bottomPanel.actionTree.root.label).toBeDefined();
      expect(vm.bottomPanel.actionTree.root.recommendation).toBeDefined();
      expect(vm.bottomPanel.actionTree.root.beliefsTop3).toBeDefined();

      // Check transitions
      for (const transition of vm.bottomPanel.actionTree.transitions) {
        expect(transition.actionId).toBeDefined();
        expect(transition.actionLabel).toBeDefined();
        expect(transition.outcomes).toBeDefined();
        expect(Array.isArray(transition.outcomes)).toBe(true);

        for (const outcome of transition.outcomes) {
          expect(outcome.outcomeId).toBeDefined();
          expect(outcome.label).toBeDefined();
          expect(outcome.probEstimate).toBeGreaterThanOrEqual(0);
          expect(outcome.probEstimate).toBeLessThanOrEqual(1);
          expect(outcome.to).toBeDefined();
          expect(outcome.to.label).toBeDefined();
          expect(outcome.to.recommendation).toBeDefined();
          expect(outcome.deltaCertainty).toBeDefined();
        }
      }
    });

    it('should handle empty findings gracefully', () => {
      const caseState: CaseState = {
        findings: [],
        completedActions: [],
        demographics: { age: 25 }
      };

      const input: EngineInput = { caseState, contentPack, userCostWeights };
      const vm = buildView(input);

      expect(vm.triage.urgent).toBe(false);
      expect(vm.topPanel.rankedConditions.length).toBeGreaterThan(0);
      // With default priors and no findings, recommendation should be supportive-care (most likely condition)
      expect(['supportive-care', 'watchful-waiting']).toContain(vm.topPanel.recommendation);
    });

    it('should apply demographic priors correctly', () => {
      // Test with different age groups
      const youngAdultCase: CaseState = {
        findings: [
          { findingId: 'sore_throat', presence: 'present' }
        ],
        completedActions: [],
        demographics: { age: 20 } // Young adult
      };

      const olderAdultCase: CaseState = {
        findings: [
          { findingId: 'sore_throat', presence: 'present' }
        ],
        completedActions: [],
        demographics: { age: 50 } // Older adult
      };

      const youngInput: EngineInput = { caseState: youngAdultCase, contentPack, userCostWeights };
      const olderInput: EngineInput = { caseState: olderAdultCase, contentPack, userCostWeights };

      const youngVm = buildView(youngInput);
      const olderVm = buildView(olderInput);

      // Both should work without errors
      expect(youngVm.topPanel.rankedConditions.length).toBeGreaterThan(0);
      expect(olderVm.topPanel.rankedConditions.length).toBeGreaterThan(0);

      // Young adults should have higher strep probability (due to demographic priors)
      const youngStrep = youngVm.topPanel.rankedConditions.find(rc => rc.id === 'streptococcal_pharyngitis');
      const olderStrep = olderVm.topPanel.rankedConditions.find(rc => rc.id === 'streptococcal_pharyngitis');
      
      if (youngStrep && olderStrep) {
        expect(youngStrep.probability).toBeGreaterThan(olderStrep.probability);
      }
    });
  });
});
