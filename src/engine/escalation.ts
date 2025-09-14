/**
 * MapMyHealth Escalation Engine
 *
 * Handles symptom worsening escalation, triage updates, and care pathway progression
 */

import {
  EscalationRule,
  EscalationAction,
  UrgencyEffect,
  NextActionEffect,
  ActionChain,
  TriageResult,
  CaseState,
  FindingValue,
  ActionDef,
  ContentPack
} from './types';

export interface EscalationResult {
  escalations: EscalationAction[];
  newTriage: TriageResult;
  additionalActions: string[];
  requiresReevaluation: boolean;
  escalationReason?: string;
}

/**
 * Built-in escalation rules for common scenarios
 */
const ESCALATION_RULES: Record<string, EscalationRule[]> = {
  "symptom_worsening": [
    {
      condition: "symptom_worsening",
      action: "change_triage",
      parameters: { urgent: true, flags: ["symptom_progression"], reason: "Symptoms worsening after observation period" }
    },
    {
      condition: "symptom_worsening",
      action: "add_actions",
      parameters: {
        actionIds: ["urgent_medical_evaluation", "consider_er_visit"],
        priority: "high"
      }
    },
    {
      condition: "symptom_worsening",
      action: "reevaluate",
      parameters: { reason: "Clinical deterioration requires reassessment" }
    }
  ],
  "red_flag_detected": [
    {
      condition: "red_flag_detected",
      action: "urgent_care",
      parameters: {
        urgent: true,
        flags: ["red_flag"],
        reason: "Red flag symptoms detected - immediate medical attention required"
      }
    }
  ]
};

/**
 * Action chains for escalation pathways
 */
const ACTION_CHAINS: ActionChain[] = [
  {
    id: "worsening_escalation_chain",
    trigger: "symptom_worsening",
    requiredPrecedingAction: "wait_observe_48h",
    chainedActions: [
      "urgent_medical_evaluation",
      "reassess_symptoms",
      "consider_er_visit"
    ],
    automaticProgression: false
  },
  {
    id: "urgent_care_chain",
    trigger: "red_flag_detected",
    requiredPrecedingAction: "",
    chainedActions: [
      "immediate_medical_attention",
      "emergency_services_contact"
    ],
    automaticProgression: true
  }
];

export class EscalationProcessor {
  private contentPack: ContentPack;

  constructor(contentPack: ContentPack) {
    this.contentPack = contentPack;
  }

  /**
   * Process outcome effects and determine escalations
   */
  processOutcomeEscalation(
    actionId: string,
    outcomeId: string,
    effects: FindingValue[],
    currentTriage: TriageResult,
    currentState: CaseState
  ): EscalationResult {
    const escalations: EscalationAction[] = [];
    let newTriage = currentTriage;
    let additionalActions: string[] = [];
    let requiresReevaluation = false;
    let escalationReason = "";

    // Check each effect for escalation triggers
    for (const effect of effects) {
      const rules = ESCALATION_RULES[effect.findingId];
      if (rules) {
        escalationReason = `Escalation triggered by ${effect.findingId}`;

        for (const rule of rules) {
          switch (rule.action) {
            case "change_triage":
              newTriage = this.processTriageEscalation(rule.parameters, currentTriage);
              escalations.push({
                type: "change_triage",
                reason: rule.parameters.reason || escalationReason,
                parameters: rule.parameters
              });
              break;

            case "add_actions":
              additionalActions.push(...rule.parameters.actionIds);
              escalations.push({
                type: "add_actions",
                reason: `Adding escalation actions due to ${effect.findingId}`,
                parameters: rule.parameters
              });
              break;

            case "urgent_care":
              newTriage = {
                urgent: true,
                flags: [...(currentTriage.flags || []), ...(rule.parameters.flags || [])]
              };
              escalations.push({
                type: "urgent_care",
                reason: rule.parameters.reason || "Urgent care required",
                parameters: rule.parameters
              });
              break;

            case "reevaluate":
              requiresReevaluation = true;
              escalations.push({
                type: "notify_provider",
                reason: rule.parameters.reason || "Clinical reassessment needed",
                parameters: rule.parameters
              });
              break;
          }
        }
      }
    }

    // Check for action chains
    const chains = this.findApplicableChains(actionId, effects, currentState);
    for (const chain of chains) {
      additionalActions.push(...chain.chainedActions);
      if (chain.automaticProgression) {
        requiresReevaluation = true;
      }
    }

    // Remove duplicates
    additionalActions = [...new Set(additionalActions)];

    return {
      escalations,
      newTriage,
      additionalActions,
      requiresReevaluation,
      escalationReason
    };
  }

  /**
   * Process triage escalation
   */
  private processTriageEscalation(
    parameters: any,
    currentTriage: TriageResult
  ): TriageResult {
    return {
      urgent: parameters.urgent !== undefined ? parameters.urgent : currentTriage.urgent,
      flags: [
        ...(currentTriage.flags || []),
        ...(parameters.flags || [])
      ]
    };
  }

  /**
   * Find applicable action chains
   */
  private findApplicableChains(
    actionId: string,
    effects: FindingValue[],
    currentState: CaseState
  ): ActionChain[] {
    const applicableChains: ActionChain[] = [];

    for (const chain of ACTION_CHAINS) {
      // Check if this chain applies to the current action
      if (chain.requiredPrecedingAction &&
          !currentState.completedActions.some(ca => ca.actionId === chain.requiredPrecedingAction)) {
        continue;
      }

      // Check if any effect triggers this chain
      const triggerFound = effects.some(effect =>
        effect.findingId === chain.trigger && effect.presence === "present"
      );

      if (triggerFound) {
        applicableChains.push(chain);
      }
    }

    return applicableChains;
  }

  /**
   * Get available escalation actions
   */
  getEscalationActions(): ActionDef[] {
    return this.contentPack.actions.filter(action =>
      action.kind === "EscalationAction" ||
      action.id.includes("urgent") ||
      action.id.includes("escalation")
    );
  }

  /**
   * Check if action requires escalation processing
   */
  shouldProcessEscalation(effects: FindingValue[]): boolean {
    return effects.some(effect =>
      ESCALATION_RULES[effect.findingId] !== undefined
    );
  }
}

/**
 * Factory function to create escalation processor
 */
export function createEscalationProcessor(contentPack: ContentPack): EscalationProcessor {
  return new EscalationProcessor(contentPack);
}