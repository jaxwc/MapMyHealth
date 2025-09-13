/**
 * MapMyHealth Engine - Triage Module Tests
 * 
 * Tests for red flag detection and triage functionality.
 */

import { 
  checkRedFlags, 
  getRedFlagDefinitions, 
  isRedFlag 
} from '../engine/triage';
import { CaseState, FindingDef } from '../engine/types';

describe('Triage Module', () => {
  const mockFindingDefs: FindingDef[] = [
    {
      id: 'sore_throat',
      label: 'Sore throat',
      kind: 'symptom',
      isRedFlag: false
    },
    {
      id: 'fever',
      label: 'Fever',
      kind: 'symptom',
      isRedFlag: false
    },
    {
      id: 'drooling',
      label: 'Drooling',
      kind: 'symptom',
      isRedFlag: true
    },
    {
      id: 'stridor',
      label: 'Stridor',
      kind: 'symptom',
      isRedFlag: true
    },
    {
      id: 'neck_swelling_fever',
      label: 'Neck swelling with fever',
      kind: 'symptom',
      isRedFlag: true
    }
  ];

  describe('checkRedFlags', () => {
    it('should return urgent=false when no red flags are present', () => {
      const caseState: CaseState = {
        findings: [
          {
            findingId: 'sore_throat',
            presence: 'present'
          },
          {
            findingId: 'fever',
            presence: 'present'
          }
        ],
        completedActions: []
      };

      const result = checkRedFlags(caseState, mockFindingDefs);

      expect(result.urgent).toBe(false);
      expect(result.flags).toBeUndefined();
    });

    it('should return urgent=true when red flags are present', () => {
      const caseState: CaseState = {
        findings: [
          {
            findingId: 'sore_throat',
            presence: 'present'
          },
          {
            findingId: 'drooling',
            presence: 'present'
          }
        ],
        completedActions: []
      };

      const result = checkRedFlags(caseState, mockFindingDefs);

      expect(result.urgent).toBe(true);
      expect(result.flags).toBeDefined();
      expect(result.flags).toContain('drooling');
    });

    it('should identify multiple red flags', () => {
      const caseState: CaseState = {
        findings: [
          {
            findingId: 'drooling',
            presence: 'present'
          },
          {
            findingId: 'stridor',
            presence: 'present'
          },
          {
            findingId: 'neck_swelling_fever',
            presence: 'present'
          }
        ],
        completedActions: []
      };

      const result = checkRedFlags(caseState, mockFindingDefs);

      expect(result.urgent).toBe(true);
      expect(result.flags).toContain('drooling');
      expect(result.flags).toContain('stridor');
      expect(result.flags).toContain('neck_swelling_fever');
      expect(result.flags?.length).toBe(3);
    });

    it('should ignore absent red flags', () => {
      const caseState: CaseState = {
        findings: [
          {
            findingId: 'drooling',
            presence: 'absent'
          },
          {
            findingId: 'stridor',
            presence: 'present'
          }
        ],
        completedActions: []
      };

      const result = checkRedFlags(caseState, mockFindingDefs);

      expect(result.urgent).toBe(true);
      expect(result.flags).toContain('stridor');
      expect(result.flags).not.toContain('drooling');
    });

    it('should ignore unknown red flags', () => {
      const caseState: CaseState = {
        findings: [
          {
            findingId: 'drooling',
            presence: 'unknown'
          },
          {
            findingId: 'stridor',
            presence: 'present'
          }
        ],
        completedActions: []
      };

      const result = checkRedFlags(caseState, mockFindingDefs);

      expect(result.urgent).toBe(true);
      expect(result.flags).toContain('stridor');
      expect(result.flags).not.toContain('drooling');
    });

    it('should handle empty findings array', () => {
      const caseState: CaseState = {
        findings: [],
        completedActions: []
      };

      const result = checkRedFlags(caseState, mockFindingDefs);

      expect(result.urgent).toBe(false);
      expect(result.flags).toBeUndefined();
    });

    it('should handle empty finding definitions', () => {
      const caseState: CaseState = {
        findings: [
          {
            findingId: 'drooling',
            presence: 'present'
          }
        ],
        completedActions: []
      };

      const result = checkRedFlags(caseState, []);

      expect(result.urgent).toBe(false);
      expect(result.flags).toBeUndefined();
    });

    it('should handle findings not in definitions', () => {
      const caseState: CaseState = {
        findings: [
          {
            findingId: 'unknown_finding',
            presence: 'present'
          }
        ],
        completedActions: []
      };

      const result = checkRedFlags(caseState, mockFindingDefs);

      expect(result.urgent).toBe(false);
      expect(result.flags).toBeUndefined();
    });
  });

  describe('getRedFlagDefinitions', () => {
    it('should return only red flag findings', () => {
      const redFlags = getRedFlagDefinitions(mockFindingDefs);

      expect(redFlags).toHaveLength(3);
      expect(redFlags.map(f => f.id)).toEqual(['drooling', 'stridor', 'neck_swelling_fever']);
      
      for (const redFlag of redFlags) {
        expect(redFlag.isRedFlag).toBe(true);
      }
    });

    it('should return empty array when no red flags exist', () => {
      const nonRedFlagFindings: FindingDef[] = [
        {
          id: 'sore_throat',
          label: 'Sore throat',
          kind: 'symptom',
          isRedFlag: false
        },
        {
          id: 'fever',
          label: 'Fever',
          kind: 'symptom',
          isRedFlag: false
        }
      ];

      const redFlags = getRedFlagDefinitions(nonRedFlagFindings);

      expect(redFlags).toHaveLength(0);
    });

    it('should handle empty finding definitions', () => {
      const redFlags = getRedFlagDefinitions([]);

      expect(redFlags).toHaveLength(0);
    });
  });

  describe('isRedFlag', () => {
    it('should return true for red flag findings', () => {
      expect(isRedFlag('drooling', mockFindingDefs)).toBe(true);
      expect(isRedFlag('stridor', mockFindingDefs)).toBe(true);
      expect(isRedFlag('neck_swelling_fever', mockFindingDefs)).toBe(true);
    });

    it('should return false for non-red flag findings', () => {
      expect(isRedFlag('sore_throat', mockFindingDefs)).toBe(false);
      expect(isRedFlag('fever', mockFindingDefs)).toBe(false);
    });

    it('should return false for non-existent findings', () => {
      expect(isRedFlag('non_existent', mockFindingDefs)).toBe(false);
    });

    it('should handle empty finding definitions', () => {
      expect(isRedFlag('drooling', [])).toBe(false);
    });

    it('should handle undefined isRedFlag property', () => {
      const findingsWithUndefined: FindingDef[] = [
        {
          id: 'test_finding',
          label: 'Test finding',
          kind: 'symptom'
          // isRedFlag is undefined
        }
      ];

      expect(isRedFlag('test_finding', findingsWithUndefined)).toBe(false);
    });
  });
});
