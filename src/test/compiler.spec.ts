/**
 * MapMyHealth Engine - Compiler Module Tests
 * 
 * Tests for clinical state compilation and action tree generation.
 */

import { 
  compileState, 
  compileActionOutcomesForState,
  getConditionRankings,
  generateWhyExplanation
} from '../engine/compiler';
import { Beliefs, ConditionDef, RankedAction, ActionDef, TestPerformanceDef } from '../engine/types';

describe('Compiler Module', () => {
  const mockBeliefs: Beliefs = {
    'strep': 0.60,
    'viral': 0.35,
    'mono': 0.05
  };

  const mockConditions: ConditionDef[] = [
    {
      id: 'strep',
      label: 'Streptococcal pharyngitis',
      description: 'Bacterial infection',
      priors: { default: 0.15 },
      thresholds: {
        confirm: 0.80,
        likely: 0.40,
        leadDelta: 0.20
      },
      lrTable: [],
      recommendations: {
        confirmed: 'targeted-care',
        likely: 'supportive-care',
        inconclusive: 'watchful-waiting'
      }
    },
    {
      id: 'viral',
      label: 'Viral pharyngitis',
      description: 'Viral infection',
      priors: { default: 0.70 },
      thresholds: {
        confirm: 0.80,
        likely: 0.50,
        leadDelta: 0.15
      },
      lrTable: [],
      recommendations: {
        confirmed: 'supportive-care',
        likely: 'supportive-care',
        inconclusive: 'watchful-waiting'
      }
    },
    {
      id: 'mono',
      label: 'Infectious mononucleosis',
      description: 'Viral infection',
      priors: { default: 0.10 },
      thresholds: {
        confirm: 0.75,
        likely: 0.40,
        leadDelta: 0.20
      },
      lrTable: [],
      recommendations: {
        confirmed: 'supportive-care',
        likely: 'supportive-care',
        inconclusive: 'watchful-waiting'
      }
    }
  ];

  const mockRankedActions: RankedAction[] = [
    {
      actionId: 'rapid_strep_test',
      utility: 0.8,
      expectedInfoGain: 0.6,
      costs: {
        money: 25,
        timeHours: 0.5,
        difficulty: 1,
        risk: 0
      },
      outcomeProbs: {
        'rapid_strep_positive': 0.3,
        'rapid_strep_negative': 0.7
      },
      previews: {
        'rapid_strep_positive': {
          'strep': 0.85,
          'viral': 0.10,
          'mono': 0.05
        },
        'rapid_strep_negative': {
          'strep': 0.20,
          'viral': 0.75,
          'mono': 0.05
        }
      }
    }
  ];

  const mockActions: ActionDef[] = [
    {
      id: 'rapid_strep_test',
      label: 'Rapid strep test',
      kind: 'Test',
      costs: {
        money: 25,
        timeHours: 0.5,
        difficulty: 1,
        risk: 0
      },
      outcomes: [
        {
          id: 'rapid_strep_positive',
          label: 'Positive result',
          probabilityHint: 0.3,
          effects: []
        },
        {
          id: 'rapid_strep_negative',
          label: 'Negative result',
          probabilityHint: 0.7,
          effects: []
        }
      ]
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

  describe('compileState', () => {
    it('should compile beliefs into clinical state root', () => {
      const rootState = compileState(mockBeliefs, mockConditions);

      expect(rootState.stateId).toBe('root');
      expect(rootState.label).toBeDefined();
      expect(rootState.recommendation).toBeDefined();
      expect(rootState.beliefsTop3).toBeDefined();
      expect(Array.isArray(rootState.beliefsTop3)).toBe(true);
      expect(rootState.beliefsTop3.length).toBeLessThanOrEqual(3);
    });

    it('should generate appropriate label for likely diagnosis', () => {
      const likelyBeliefs: Beliefs = {
        'strep': 0.60, // Above likely threshold (0.40) and lead delta (0.20)
        'viral': 0.35, // Lead delta = 0.60 - 0.35 = 0.25 > 0.20
        'mono': 0.05
      };

      const rootState = compileState(likelyBeliefs, mockConditions);

      expect(rootState.label).toContain('Streptococcal pharyngitis');
      expect(rootState.label).toContain('likely');
      expect(rootState.recommendation).toBe('supportive-care');
    });

    it('should generate appropriate label for confirmed diagnosis', () => {
      const confirmedBeliefs: Beliefs = {
        'strep': 0.85, // Above confirm threshold (0.80)
        'viral': 0.10,
        'mono': 0.05
      };

      const rootState = compileState(confirmedBeliefs, mockConditions);

      expect(rootState.label).toContain('Streptococcal pharyngitis');
      expect(rootState.label).toContain('confirmed');
      expect(rootState.recommendation).toBe('targeted-care');
    });

    it('should generate appropriate label for inconclusive diagnosis', () => {
      const inconclusiveBeliefs: Beliefs = {
        'strep': 0.45, // Above likely but insufficient lead delta
        'viral': 0.40, // Lead delta = 0.45 - 0.40 = 0.05 < 0.20
        'mono': 0.15
      };

      const rootState = compileState(inconclusiveBeliefs, mockConditions);

      expect(rootState.recommendation).toBe('watchful-waiting');
    });

    it('should include top 3 beliefs in correct order', () => {
      const rootState = compileState(mockBeliefs, mockConditions);

      expect(rootState.beliefsTop3[0].conditionId).toBe('strep');
      expect(rootState.beliefsTop3[0].probability).toBeCloseTo(0.60, 2);
      expect(rootState.beliefsTop3[1].conditionId).toBe('viral');
      expect(rootState.beliefsTop3[1].probability).toBeCloseTo(0.35, 2);
    });

    it('should handle empty beliefs', () => {
      const emptyBeliefs: Beliefs = {};
      const rootState = compileState(emptyBeliefs, mockConditions);

      expect(rootState.label).toBe('No clear diagnosis');
      expect(rootState.beliefsTop3).toHaveLength(0);
    });
  });

  describe('compileActionOutcomesForState', () => {
    it('should compile action outcomes into state tree', () => {
      const rootState = compileState(mockBeliefs, mockConditions);
      const stateTree = compileActionOutcomesForState(
        rootState,
        mockBeliefs,
        mockRankedActions,
        mockActions,
        mockConditions,
        mockTestPerformance
      );

      expect(stateTree.root).toBe(rootState);
      expect(stateTree.transitions).toBeDefined();
      expect(Array.isArray(stateTree.transitions)).toBe(true);
      expect(stateTree.transitions.length).toBe(1); // One action
    });

    it('should generate transitions with correct structure', () => {
      const rootState = compileState(mockBeliefs, mockConditions);
      const stateTree = compileActionOutcomesForState(
        rootState,
        mockBeliefs,
        mockRankedActions,
        mockActions,
        mockConditions,
        mockTestPerformance
      );

      const transition = stateTree.transitions[0];
      expect(transition.actionId).toBe('rapid_strep_test');
      expect(transition.actionLabel).toBe('Rapid strep test');
      expect(transition.outcomes).toBeDefined();
      expect(Array.isArray(transition.outcomes)).toBe(true);
      expect(transition.outcomes.length).toBe(2); // Two outcomes
    });

    it('should generate outcomes with correct structure', () => {
      const rootState = compileState(mockBeliefs, mockConditions);
      const stateTree = compileActionOutcomesForState(
        rootState,
        mockBeliefs,
        mockRankedActions,
        mockActions,
        mockConditions,
        mockTestPerformance
      );

      const outcome = stateTree.transitions[0].outcomes[0];
      expect(outcome.outcomeId).toBeDefined();
      expect(outcome.label).toBeDefined();
      expect(outcome.probEstimate).toBeDefined();
      expect(outcome.to).toBeDefined();
      expect(outcome.to.label).toBeDefined();
      expect(outcome.to.recommendation).toBeDefined();
      expect(outcome.to.beliefsTop3).toBeDefined();
      expect(outcome.deltaCertainty).toBeDefined();
    });

    it('should calculate delta certainty correctly', () => {
      const rootState = compileState(mockBeliefs, mockConditions);
      const stateTree = compileActionOutcomesForState(
        rootState,
        mockBeliefs,
        mockRankedActions,
        mockActions,
        mockConditions,
        mockTestPerformance
      );

      for (const transition of stateTree.transitions) {
        for (const outcome of transition.outcomes) {
          expect(typeof outcome.deltaCertainty).toBe('number');
          // Delta certainty should be meaningful (not NaN or undefined)
          expect(isNaN(outcome.deltaCertainty)).toBe(false);
        }
      }
    });

    it('should handle empty ranked actions', () => {
      const rootState = compileState(mockBeliefs, mockConditions);
      const stateTree = compileActionOutcomesForState(
        rootState,
        mockBeliefs,
        [], // Empty ranked actions
        mockActions,
        mockConditions,
        mockTestPerformance
      );

      expect(stateTree.transitions).toHaveLength(0);
    });
  });

  describe('getConditionRankings', () => {
    it('should return condition rankings with status labels', () => {
      const rankings = getConditionRankings(mockBeliefs, mockConditions, 5);

      expect(Array.isArray(rankings)).toBe(true);
      expect(rankings.length).toBeLessThanOrEqual(5);
      expect(rankings.length).toBeGreaterThan(0);

      for (const ranking of rankings) {
        expect(ranking.id).toBeDefined();
        expect(ranking.label).toBeDefined();
        expect(ranking.probability).toBeDefined();
        expect(ranking.statusLabel).toBeDefined();
        expect(['confirmed', 'likely', 'inconclusive']).toContain(ranking.statusLabel);
      }
    });

    it('should rank conditions by probability in descending order', () => {
      const rankings = getConditionRankings(mockBeliefs, mockConditions, 5);

      for (let i = 0; i < rankings.length - 1; i++) {
        expect(rankings[i].probability).toBeGreaterThanOrEqual(rankings[i + 1].probability);
      }
    });

    it('should respect maxCount parameter', () => {
      const rankings = getConditionRankings(mockBeliefs, mockConditions, 2);

      expect(rankings.length).toBeLessThanOrEqual(2);
    });

    it('should assign correct status labels based on thresholds', () => {
      const confirmedBeliefs: Beliefs = {
        'strep': 0.85, // Above confirm threshold
        'viral': 0.10,
        'mono': 0.05
      };

      const rankings = getConditionRankings(confirmedBeliefs, mockConditions, 3);

      const strepRanking = rankings.find(r => r.id === 'strep');
      expect(strepRanking?.statusLabel).toBe('confirmed');
    });
  });

  describe('generateWhyExplanation', () => {
    it('should generate explanation for a condition', () => {
      const explanation = generateWhyExplanation('strep', mockBeliefs, mockConditions);

      expect(explanation).toBeDefined();
      expect(explanation.supporting).toBeDefined();
      expect(explanation.contradicting).toBeDefined();
      expect(Array.isArray(explanation.supporting)).toBe(true);
      expect(Array.isArray(explanation.contradicting)).toBe(true);
    });

    it('should handle non-existent condition', () => {
      const explanation = generateWhyExplanation('non_existent', mockBeliefs, mockConditions);

      expect(explanation.supporting).toHaveLength(0);
      expect(explanation.contradicting).toHaveLength(0);
    });

    it('should handle empty beliefs', () => {
      const emptyBeliefs: Beliefs = {};
      const explanation = generateWhyExplanation('strep', emptyBeliefs, mockConditions);

      expect(explanation).toBeDefined();
      expect(explanation.supporting).toBeDefined();
      expect(explanation.contradicting).toBeDefined();
    });
  });
});
