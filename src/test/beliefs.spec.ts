/**
 * MapMyHealth Engine - Beliefs Module Tests
 * 
 * Tests for belief updating, prior seeding, and classification functionality.
 */

import { 
  seedPriors, 
  applyEvidence, 
  classify 
} from '../engine/beliefs';
import { CaseState, ConditionDef, TestPerformanceDef, Beliefs } from '../engine/types';

describe('Beliefs Module', () => {
  const mockConditions: ConditionDef[] = [
    {
      id: 'strep',
      label: 'Streptococcal pharyngitis',
      description: 'Bacterial infection',
      priors: {
        default: 0.15,
        byDemo: [
          {
            ageRange: { min: 15, max: 44 },
            prior: 0.10
          }
        ]
      },
      thresholds: {
        confirm: 0.80,
        likely: 0.40,
        leadDelta: 0.20
      },
      lrTable: [
        {
          target: 'fever',
          LRpos: 1.7,
          LRneg: 0.5,
          note: 'Test LR',
          source: { source: 'Test Source', year: 2020 }
        },
        {
          target: 'cough',
          LRpos: 0.3,
          LRneg: 2.1,
          note: 'Cough suggests viral',
          source: { source: 'Test Source', year: 2020 }
        }
      ],
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
      priors: {
        default: 0.70
      },
      thresholds: {
        confirm: 0.80,
        likely: 0.50,
        leadDelta: 0.15
      },
      lrTable: [
        {
          target: 'cough',
          LRpos: 2.1,
          LRneg: 0.6,
          note: 'Cough suggests viral',
          source: { source: 'Test Source', year: 2020 }
        }
      ],
      recommendations: {
        confirmed: 'supportive-care',
        likely: 'supportive-care',
        inconclusive: 'watchful-waiting'
      }
    }
  ];

  const mockTestPerformance: TestPerformanceDef[] = [
    {
      id: 'test_perf',
      testId: 'rapid_strep',
      sensitivity: 0.85,
      specificity: 0.95,
      source: { source: 'Test Source', year: 2020 }
    }
  ];

  describe('seedPriors', () => {
    it('should seed default priors correctly', () => {
      const caseState: CaseState = {
        findings: [],
        completedActions: []
      };

      const beliefs = seedPriors(caseState, mockConditions);
      
      // After normalization: 0.15 + 0.70 = 0.85, so normalized values are 0.15/0.85 ≈ 0.176 and 0.70/0.85 ≈ 0.824
      expect(beliefs['strep']).toBeCloseTo(0.176, 2);
      expect(beliefs['viral']).toBeCloseTo(0.824, 2);
      
      // Should normalize to sum to 1
      const sum = Object.values(beliefs).reduce((acc, prob) => acc + prob, 0);
      expect(sum).toBeCloseTo(1.0, 2);
    });

    it('should apply demographic priors when available', () => {
      const caseState: CaseState = {
        demographics: { age: 25 },
        findings: [],
        completedActions: []
      };

      const beliefs = seedPriors(caseState, mockConditions);
      
      // After normalization with age-specific priors: 0.10 + 0.70 = 0.80, so normalized values are 0.10/0.80 = 0.125 and 0.70/0.80 = 0.875
      expect(beliefs['strep']).toBeCloseTo(0.125, 2);
      expect(beliefs['viral']).toBeCloseTo(0.875, 2);
    });

    it('should handle empty conditions array', () => {
      const caseState: CaseState = {
        findings: [],
        completedActions: []
      };

      const beliefs = seedPriors(caseState, []);
      expect(Object.keys(beliefs)).toHaveLength(0);
    });
  });

  describe('applyEvidence', () => {
    it('should update beliefs with positive test result', () => {
      const initialBeliefs: Beliefs = {
        'strep': 0.15,
        'viral': 0.85
      };

      const caseState: CaseState = {
        findings: [
          {
            findingId: 'fever',
            presence: 'present'
          }
        ],
        completedActions: []
      };

      const updatedBeliefs = applyEvidence(
        initialBeliefs,
        caseState,
        mockConditions,
        mockTestPerformance
      );

      // Fever should increase strep probability (LR+ = 1.7)
      expect(updatedBeliefs['strep']).toBeGreaterThan(initialBeliefs['strep']);
      expect(updatedBeliefs['viral']).toBeLessThan(initialBeliefs['viral']);
      
      // Should still normalize
      const sum = Object.values(updatedBeliefs).reduce((acc, prob) => acc + prob, 0);
      expect(sum).toBeCloseTo(1.0, 2);
    });

    it('should update beliefs with negative test result', () => {
      const initialBeliefs: Beliefs = {
        'strep': 0.15,
        'viral': 0.85
      };

      const caseState: CaseState = {
        findings: [
          {
            findingId: 'cough',
            presence: 'present'
          }
        ],
        completedActions: []
      };

      const updatedBeliefs = applyEvidence(
        initialBeliefs,
        caseState,
        mockConditions,
        mockTestPerformance
      );

      // Cough should decrease strep probability (LR+ = 0.3) and increase viral (LR+ = 2.1)
      expect(updatedBeliefs['strep']).toBeLessThan(initialBeliefs['strep']);
      expect(updatedBeliefs['viral']).toBeGreaterThan(initialBeliefs['viral']);
    });

    it('should skip unknown findings', () => {
      const initialBeliefs: Beliefs = {
        'strep': 0.15,
        'viral': 0.85
      };

      const caseState: CaseState = {
        findings: [
          {
            findingId: 'fever',
            presence: 'unknown'
          }
        ],
        completedActions: []
      };

      const updatedBeliefs = applyEvidence(
        initialBeliefs,
        caseState,
        mockConditions,
        mockTestPerformance
      );

      // Unknown findings should not change beliefs
      expect(updatedBeliefs['strep']).toBeCloseTo(initialBeliefs['strep'], 2);
      expect(updatedBeliefs['viral']).toBeCloseTo(initialBeliefs['viral'], 2);
    });

    it('should handle piecewise test performance by days since onset', () => {
      const initialBeliefs: Beliefs = {
        'strep': 0.15,
        'viral': 0.85
      };

      const caseState: CaseState = {
        findings: [
          {
            findingId: 'rapid_strep_positive',
            presence: 'present',
            daysSinceOnset: 2
          }
        ],
        completedActions: []
      };

      const testPerfWithPiecewise: TestPerformanceDef[] = [
        {
          id: 'rapid_strep_performance',
          testId: 'rapid_strep',
          sensitivity: 0.85,
          specificity: 0.95,
          piecewiseByDaysSinceOnset: [
            {
              daysRange: { min: 0, max: 3 },
              sensitivity: 0.70,
              specificity: 0.95
            }
          ],
          source: { source: 'Test Source', year: 2020 }
        }
      ];

      const updatedBeliefs = applyEvidence(
        initialBeliefs,
        caseState,
        mockConditions,
        testPerfWithPiecewise
      );

      // Should apply piecewise performance (different from default)
      expect(updatedBeliefs).toBeDefined();
      const sum = Object.values(updatedBeliefs).reduce((acc, prob) => acc + prob, 0);
      expect(sum).toBeCloseTo(1.0, 2);
    });
  });

  describe('classify', () => {
    it('should classify as confirmed when probability exceeds threshold', () => {
      const beliefs: Beliefs = {
        'strep': 0.85, // Above confirm threshold (0.80)
        'viral': 0.15
      };

      const classification = classify(beliefs, mockConditions);

      expect(classification.label).toBe('confirmed');
      expect(classification.recommendation).toBe('targeted-care');
      expect(classification.top[0][0]).toBe('strep');
      expect(classification.top[0][1]).toBeCloseTo(0.85, 2);
    });

    it('should classify as likely when probability exceeds likely threshold and lead delta', () => {
      const beliefs: Beliefs = {
        'strep': 0.50, // Above likely threshold (0.40) and lead delta (0.20)
        'viral': 0.20  // Lead delta = 0.50 - 0.20 = 0.30 > 0.20
      };

      const classification = classify(beliefs, mockConditions);

      expect(classification.label).toBe('likely');
      expect(classification.recommendation).toBe('supportive-care');
    });

    it('should classify as inconclusive when lead delta is insufficient', () => {
      const beliefs: Beliefs = {
        'strep': 0.50, // Above likely threshold but...
        'viral': 0.40  // Lead delta = 0.50 - 0.40 = 0.10 < 0.20
      };

      const classification = classify(beliefs, mockConditions);

      expect(classification.label).toBe('inconclusive');
      expect(classification.recommendation).toBe('watchful-waiting');
    });

    it('should handle empty beliefs', () => {
      const beliefs: Beliefs = {};

      const classification = classify(beliefs, mockConditions);

      expect(classification.label).toBe('inconclusive');
      expect(classification.recommendation).toBe('watchful-waiting');
      expect(classification.top).toHaveLength(0);
    });
  });
});
