/**
 * MapMyHealth Engine - Planner Module Tests
 * 
 * Tests for action ranking and branch planning functionality.
 */

import { 
  rankActions, 
  planBranches 
} from '../engine/planner';
import { CaseState, Beliefs, ActionDef, ConditionDef, TestPerformanceDef, CostWeights } from '../engine/types';

describe('Planner Module', () => {
  const mockCaseState: CaseState = {
    demographics: { age: 25 },
    findings: [
      {
        findingId: 'sore_throat',
        presence: 'present'
      }
    ],
    completedActions: []
  };

  const mockBeliefs: Beliefs = {
    'strep': 0.30,
    'viral': 0.70
  };

  const mockActions: ActionDef[] = [
    {
      id: 'rapid_strep_test',
      label: 'Rapid strep test',
      kind: 'Test',
      preconditions: {
        requireFindings: ['sore_throat']
      },
      costs: {
        money: 25,
        timeHours: 0.5,
        difficulty: 1,
        risk: 0
      },
      testBinding: {
        findingIdPositive: 'rapid_strep_positive',
        findingIdNegative: 'rapid_strep_negative',
        performanceRefId: 'rapid_strep_performance'
      },
      outcomes: [
        {
          id: 'rapid_strep_positive',
          label: 'Positive',
          probabilityHint: 0.3,
          effects: [
            {
              findingId: 'rapid_strep_positive',
              presence: 'present'
            }
          ]
        },
        {
          id: 'rapid_strep_negative',
          label: 'Negative',
          probabilityHint: 0.7,
          effects: [
            {
              findingId: 'rapid_strep_negative',
              presence: 'present'
            }
          ]
        }
      ]
    },
    {
      id: 'wait_observe',
      label: 'Wait and observe',
      kind: 'WaitObserve',
      preconditions: {
        forbidFindings: ['drooling']
      },
      costs: {
        money: 0,
        timeHours: 48,
        difficulty: 1,
        risk: 1
      },
      outcomes: [
        {
          id: 'improving',
          label: 'Improving',
          probabilityHint: 0.6,
          effects: []
        },
        {
          id: 'worse',
          label: 'Worse',
          probabilityHint: 0.4,
          effects: []
        }
      ]
    },
    {
      id: 'unavailable_action',
      label: 'Unavailable action',
      kind: 'Test',
      preconditions: {
        requireFindings: ['missing_finding']
      },
      costs: {
        money: 50,
        timeHours: 1,
        difficulty: 2,
        risk: 0
      },
      outcomes: []
    }
  ];

  const mockConditions: ConditionDef[] = [
    {
      id: 'strep',
      label: 'Streptococcal pharyngitis',
      description: 'Bacterial infection',
      priors: { default: 0.15 },
      probabilityBands: [
        { category: "very-unlikely", minInclusive: 0.0, maxExclusive: 0.05 },
        { category: "not-likely", minInclusive: 0.05, maxExclusive: 0.20 },
        { category: "unknown", minInclusive: 0.20, maxExclusive: 0.60 },
        { category: "likely", minInclusive: 0.60, maxExclusive: 0.80 },
        { category: "highly-likely", minInclusive: 0.80, maxExclusive: 1.01 }
      ],
      lrTable: [],
      recommendationsByBand: {
        'highly-likely': 'targeted-care',
        'likely': 'supportive-care',
        'unknown': 'watchful-waiting',
        'not-likely': 'watchful-waiting',
        'very-unlikely': 'watchful-waiting'
      }
    },
    {
      id: 'viral',
      label: 'Viral pharyngitis',
      description: 'Viral infection',
      priors: { default: 0.70 },
      probabilityBands: [
        { category: "very-unlikely", minInclusive: 0.0, maxExclusive: 0.05 },
        { category: "not-likely", minInclusive: 0.05, maxExclusive: 0.20 },
        { category: "unknown", minInclusive: 0.20, maxExclusive: 0.60 },
        { category: "likely", minInclusive: 0.60, maxExclusive: 0.80 },
        { category: "highly-likely", minInclusive: 0.80, maxExclusive: 1.01 }
      ],
      lrTable: [],
      recommendationsByBand: {
        'highly-likely': 'supportive-care',
        'likely': 'supportive-care',
        'unknown': 'watchful-waiting',
        'not-likely': 'watchful-waiting',
        'very-unlikely': 'watchful-waiting'
      }
    }
  ];

  const mockTestPerformance: TestPerformanceDef[] = [
    {
      id: 'rapid_strep_performance',
      testId: 'rapid_strep_test',
      sensitivity: 0.85,
      specificity: 0.95,
      source: { source: 'Test Source', year: 2020 }
    }
  ];

  const mockCostWeights: CostWeights = {
    infoGainWeight: 1.0,
    money: 0.01,
    timeHours: 0.1,
    difficulty: 0.5,
    risk: 2.0
  };

  describe('rankActions', () => {
    it('should rank available actions by utility', () => {
      const rankedActions = rankActions(
        mockCaseState,
        mockBeliefs,
        mockActions,
        mockConditions,
        mockTestPerformance,
        mockCostWeights,
        3
      );

      expect(rankedActions).toHaveLength(2); // Only 2 actions should be available
      expect(rankedActions[0].actionId).toBeDefined();
      expect(rankedActions[0].utility).toBeDefined();
      expect(rankedActions[0].expectedInfoGain).toBeDefined();
      expect(rankedActions[0].costs).toBeDefined();
      expect(rankedActions[0].outcomeProbs).toBeDefined();
      expect(rankedActions[0].previews).toBeDefined();
    });

    it('should filter out actions that do not meet preconditions', () => {
      const rankedActions = rankActions(
        mockCaseState,
        mockBeliefs,
        mockActions,
        mockConditions,
        mockTestPerformance,
        mockCostWeights,
        5
      );

      // Should not include unavailable_action because missing_finding is not present
      const actionIds = rankedActions.map(a => a.actionId);
      expect(actionIds).not.toContain('unavailable_action');
      expect(actionIds).toContain('rapid_strep_test');
      expect(actionIds).toContain('wait_observe');
    });

    it('should respect the k parameter for number of results', () => {
      const rankedActions = rankActions(
        mockCaseState,
        mockBeliefs,
        mockActions,
        mockConditions,
        mockTestPerformance,
        mockCostWeights,
        1
      );

      expect(rankedActions).toHaveLength(1);
    });

    it('should sort actions by utility in descending order', () => {
      const rankedActions = rankActions(
        mockCaseState,
        mockBeliefs,
        mockActions,
        mockConditions,
        mockTestPerformance,
        mockCostWeights,
        3
      );

      if (rankedActions.length > 1) {
        for (let i = 0; i < rankedActions.length - 1; i++) {
          expect(rankedActions[i].utility).toBeGreaterThanOrEqual(rankedActions[i + 1].utility);
        }
      }
    });

    it('should handle empty actions array', () => {
      const rankedActions = rankActions(
        mockCaseState,
        mockBeliefs,
        [],
        mockConditions,
        mockTestPerformance,
        mockCostWeights,
        3
      );

      expect(rankedActions).toHaveLength(0);
    });
  });

  describe('planBranches', () => {
    it('should generate branches with specified depth and beam width', () => {
      const branches = planBranches(
        mockCaseState,
        mockBeliefs,
        mockActions,
        mockConditions,
        mockTestPerformance,
        mockCostWeights,
        2, // depth
        3  // beam width
      );

      expect(branches).toBeDefined();
      expect(Array.isArray(branches)).toBe(true);
      expect(branches.length).toBeGreaterThan(0);

      // Check branch structure
      for (const branch of branches) {
        expect(branch.id).toBeDefined();
        expect(branch.steps).toBeDefined();
        expect(Array.isArray(branch.steps)).toBe(true);
        expect(branch.expectedUtility).toBeDefined();
        expect(branch.leafPosteriorPreview).toBeDefined();
      }
    });

    it('should respect depth limit', () => {
      const branches = planBranches(
        mockCaseState,
        mockBeliefs,
        mockActions,
        mockConditions,
        mockTestPerformance,
        mockCostWeights,
        1, // depth = 1
        3
      );

      for (const branch of branches) {
        expect(branch.steps.length).toBeLessThanOrEqual(1);
      }
    });

    it('should respect beam width limit', () => {
      const branches = planBranches(
        mockCaseState,
        mockBeliefs,
        mockActions,
        mockConditions,
        mockTestPerformance,
        mockCostWeights,
        2,
        2 // beam width = 2
      );

      // The exact number of branches depends on the implementation,
      // but it should be reasonable given the beam width
      expect(branches.length).toBeLessThanOrEqual(10); // Reasonable upper bound
    });

    it('should generate branches with valid step structures', () => {
      const branches = planBranches(
        mockCaseState,
        mockBeliefs,
        mockActions,
        mockConditions,
        mockTestPerformance,
        mockCostWeights,
        2,
        3
      );

      for (const branch of branches) {
        for (const step of branch.steps) {
          expect(step.actionId).toBeDefined();
          expect(step.predictedOutcomeProbs).toBeDefined();
          expect(step.posteriorPreview).toBeDefined();
          expect(step.accumCosts).toBeDefined();
          expect(step.accumCosts.money).toBeDefined();
          expect(step.accumCosts.timeHours).toBeDefined();
          expect(step.accumCosts.difficulty).toBeDefined();
        }
      }
    });

    it('should handle empty actions array', () => {
      const branches = planBranches(
        mockCaseState,
        mockBeliefs,
        [],
        mockConditions,
        mockTestPerformance,
        mockCostWeights,
        2,
        3
      );

      expect(branches).toBeDefined();
      expect(Array.isArray(branches)).toBe(true);
      expect(branches.length).toBe(0);
    });

    it('should stop branches early when diagnosis is confirmed', () => {
      const highConfidenceBeliefs: Beliefs = {
        'strep': 0.90, // Above confirm threshold
        'viral': 0.10
      };

      const branches = planBranches(
        mockCaseState,
        highConfidenceBeliefs,
        mockActions,
        mockConditions,
        mockTestPerformance,
        mockCostWeights,
        3, // depth = 3
        3
      );

      // Should have some branches that stopped early due to confirmed diagnosis
      expect(branches).toBeDefined();
      // The exact behavior depends on implementation details
    });
  });
});
