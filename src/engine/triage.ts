/**
 * MapMyHealth Engine - Triage Module
 * 
 * Purpose: decide if planning should stop for urgent care.
 * 
 * This module implements red-flag detection to identify cases that require
 * immediate urgent care rather than continued diagnostic planning.
 */

import { CaseState, FindingDef, TriageResult } from './types';

/**
 * Check for red flags in the case state
 * 
 * @param caseState - Current case state with findings and demographics
 * @param findingDefs - Array of finding definitions to identify red flags
 * @returns TriageResult with urgent flag and list of red flag findings
 * 
 * Behavior: returns urgent=true if any red-flag finding is present
 */
export function checkRedFlags(
  caseState: CaseState,
  findingDefs: FindingDef[]
): TriageResult {
  const redFlagFindings = findingDefs.filter(finding => finding.isRedFlag);
  const redFlagIds = new Set(redFlagFindings.map(f => f.id));
  
  const presentRedFlags: string[] = [];
  
  // Check each finding in the case state
  for (const finding of caseState.findings) {
    if (finding.presence === "present" && redFlagIds.has(finding.findingId)) {
      presentRedFlags.push(finding.findingId);
    }
  }
  
  const urgent = presentRedFlags.length > 0;
  
  return {
    urgent,
    flags: urgent ? presentRedFlags : undefined
  };
}

/**
 * Get red flag finding definitions for display purposes
 * 
 * @param findingDefs - Array of all finding definitions
 * @returns Array of red flag finding definitions
 */
export function getRedFlagDefinitions(findingDefs: FindingDef[]): FindingDef[] {
  return findingDefs.filter(finding => finding.isRedFlag);
}

/**
 * Check if a specific finding is a red flag
 * 
 * @param findingId - ID of the finding to check
 * @param findingDefs - Array of finding definitions
 * @returns true if the finding is a red flag
 */
export function isRedFlag(findingId: string, findingDefs: FindingDef[]): boolean {
  const finding = findingDefs.find(f => f.id === findingId);
  return finding?.isRedFlag === true;
}
