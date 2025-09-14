/**
 * Lesson 4: Building Health Workflows
 * 
 * This lesson demonstrates how to create powerful workflows that orchestrate
 * multiple agents and tools for complex health scenarios.
 */

import 'dotenv/config';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';

// Set up storage and memory
const storage = new LibSQLStore({
  url: 'file:./health-workflows.db'
});

const memory = new Memory({
  storage,
  options: {
    lastMessages: 5,
    semanticRecall: false,
    workingMemory: { enabled: true }
  }
});

// Create specialized agents for different roles
const triageAgent = new Agent({
  name: 'Triage Agent',
  instructions: `You are a medical triage specialist. Your job is to:
  - Assess symptom severity and urgency
  - Determine if immediate medical attention is needed
  - Classify symptoms into categories (mild, moderate, severe, emergency)
  - Provide initial safety recommendations
  
  Always prioritize patient safety and recommend professional medical care when appropriate.`,
  model: google('gemini-2.5-flash'),
  memory
});

const assessmentAgent = new Agent({
  name: 'Health Assessment Agent',
  instructions: `You are a comprehensive health assessment specialist. Your job is to:
  - Conduct detailed health evaluations
  - Gather comprehensive symptom information
  - Analyze health patterns and risk factors
  - Provide detailed health recommendations
  
  Be thorough but empathetic in your assessments.`,
  model: google('gemini-2.5-flash'),
  memory
});

const recommendationAgent = new Agent({
  name: 'Recommendation Agent',
  instructions: `You are a health recommendation specialist. Your job is to:
  - Synthesize assessment data into actionable recommendations
  - Prioritize recommendations by importance and urgency
  - Provide specific, practical advice
  - Create personalized health plans
  
  Make recommendations clear, actionable, and personalized.`,
  model: google('gemini-2.5-flash'),
  memory
});

// Workflow tools
const severityAssessmentTool = createTool({
  id: 'severity-assessment',
  description: 'Assesses the severity and urgency of health symptoms',
  inputSchema: z.object({
    symptoms: z.string().describe('Symptoms to assess'),
    duration: z.string().describe('How long symptoms have been present'),
    severity: z.string().describe('Patient-reported severity level')
  }),
  execute: async ({ context }) => {
    const { symptoms, duration, severity } = context;
    
    // Simulate severity assessment logic
    let urgencyLevel = 'low';
    let category = 'mild';
    
    if (severity.toLowerCase().includes('severe') || 
        symptoms.toLowerCase().includes('chest pain') ||
        symptoms.toLowerCase().includes('difficulty breathing')) {
      urgencyLevel = 'high';
      category = 'emergency';
    } else if (severity.toLowerCase().includes('moderate') ||
               duration.includes('days') || duration.includes('weeks')) {
      urgencyLevel = 'medium';
      category = 'moderate';
    }
    
    return {
      urgencyLevel,
      category,
      requiresImmediateCare: urgencyLevel === 'high',
      recommendations: urgencyLevel === 'high' ? 
        ['Seek immediate medical attention', 'Call emergency services if needed'] :
        ['Monitor symptoms', 'Consider scheduling a doctor appointment'],
      timestamp: new Date().toISOString()
    };
  }
});

const healthRiskTool = createTool({
  id: 'health-risk-assessment',
  description: 'Assesses health risks based on symptoms and history',
  inputSchema: z.object({
    symptoms: z.string(),
    age: z.number().optional(),
    medicalHistory: z.string().optional(),
    lifestyle: z.string().optional()
  }),
  execute: async ({ context }) => {
    const { symptoms, age, medicalHistory, lifestyle } = context;
    
    const risks = [];
    const riskLevel = 'medium';
    
    if (age && age > 50) {
      risks.push('Age-related health risks');
    }
    
    if (medicalHistory?.toLowerCase().includes('diabetes')) {
      risks.push('Diabetes-related complications');
    }
    
    if (lifestyle === 'sedentary') {
      risks.push('Sedentary lifestyle risks');
    }
    
    return {
      riskLevel,
      identifiedRisks: risks,
      recommendations: [
        'Regular health monitoring',
        'Lifestyle modifications',
        'Preventive care measures'
      ]
    };
  }
});

// Workflow 1: Complete Health Assessment Pipeline
export const healthAssessmentWorkflow = createWorkflow({
  id: 'health-assessment-pipeline',
  description: 'Complete health assessment workflow that triages, assesses, and provides recommendations',
  inputSchema: z.object({
    patientId: z.string(),
    symptoms: z.string(),
    duration: z.string(),
    severity: z.string(),
    age: z.number().optional(),
    medicalHistory: z.string().optional(),
    lifestyle: z.string().optional()
  }),
  outputSchema: z.object({
    assessment: z.object({
      urgencyLevel: z.string(),
      category: z.string(),
      requiresImmediateCare: z.boolean(),
      riskAssessment: z.object({
        riskLevel: z.string(),
        identifiedRisks: z.array(z.string()),
        recommendations: z.array(z.string())
      })
    }),
    recommendations: z.array(z.string()),
    nextSteps: z.array(z.string()),
    summary: z.string()
  })
});

// Step 1: Triage Assessment
const triageStep = createStep({
  id: 'triage-assessment',
  description: 'Initial triage and severity assessment',
  inputSchema: z.object({
    symptoms: z.string(),
    duration: z.string(),
    severity: z.string()
  }),
  outputSchema: z.object({
    urgencyLevel: z.string(),
    category: z.string(),
    requiresImmediateCare: z.boolean(),
    triageRecommendations: z.array(z.string())
  }),
  execute: async ({ inputData, tools }) => {
    console.log('🔍 Step 1: Conducting triage assessment...');
    
    // Use the triage agent
    const triageResponse = await triageAgent.generateVNext(
      `Assess these symptoms for triage: ${inputData.symptoms}. Duration: ${inputData.duration}. Severity: ${inputData.severity}`
    );
    
    // Use severity assessment tool
    const severityResult = await tools.severityAssessment.execute({
      context: {
        symptoms: inputData.symptoms,
        duration: inputData.duration,
        severity: inputData.severity
      }
    });
    
    return {
      urgencyLevel: severityResult.urgencyLevel,
      category: severityResult.category,
      requiresImmediateCare: severityResult.requiresImmediateCare,
      triageRecommendations: severityResult.recommendations
    };
  }
});

// Step 2: Detailed Health Assessment
const assessmentStep = createStep({
  id: 'detailed-assessment',
  description: 'Comprehensive health assessment',
  inputSchema: z.object({
    symptoms: z.string(),
    age: z.number().optional(),
    medicalHistory: z.string().optional(),
    lifestyle: z.string().optional()
  }),
  outputSchema: z.object({
    riskAssessment: z.object({
      riskLevel: z.string(),
      identifiedRisks: z.array(z.string()),
      recommendations: z.array(z.string())
    }),
    assessmentNotes: z.string()
  }),
  execute: async ({ inputData, tools }) => {
    console.log('📋 Step 2: Conducting detailed health assessment...');
    
    // Use the assessment agent
    const assessmentResponse = await assessmentAgent.generateVNext(
      `Conduct a detailed health assessment for symptoms: ${inputData.symptoms}. Age: ${inputData.age || 'unknown'}. Medical history: ${inputData.medicalHistory || 'none provided'}. Lifestyle: ${inputData.lifestyle || 'unknown'}.`
    );
    
    // Use health risk assessment tool
    const riskResult = await tools.healthRiskAssessment.execute({
      context: {
        symptoms: inputData.symptoms,
        age: inputData.age,
        medicalHistory: inputData.medicalHistory,
        lifestyle: inputData.lifestyle
      }
    });
    
    return {
      riskAssessment: riskResult,
      assessmentNotes: assessmentResponse.text || 'Assessment completed'
    };
  }
});

// Step 3: Generate Recommendations
const recommendationStep = createStep({
  id: 'generate-recommendations',
  description: 'Generate personalized health recommendations',
  inputSchema: z.object({
    urgencyLevel: z.string(),
    category: z.string(),
    requiresImmediateCare: z.boolean(),
    riskAssessment: z.object({
      riskLevel: z.string(),
      identifiedRisks: z.array(z.string()),
      recommendations: z.array(z.string())
    }),
    assessmentNotes: z.string()
  }),
  outputSchema: z.object({
    recommendations: z.array(z.string()),
    nextSteps: z.array(z.string()),
    summary: z.string()
  }),
  execute: async ({ inputData }) => {
    console.log('💡 Step 3: Generating personalized recommendations...');
    
    // Use the recommendation agent
    const recommendationResponse = await recommendationAgent.generateVNext(
      `Based on this assessment, generate personalized recommendations:
      Urgency: ${inputData.urgencyLevel}
      Category: ${inputData.category}
      Immediate care needed: ${inputData.requiresImmediateCare}
      Risk level: ${inputData.riskAssessment.riskLevel}
      Identified risks: ${inputData.riskAssessment.identifiedRisks.join(', ')}
      Assessment notes: ${inputData.assessmentNotes}`
    );
    
    const recommendations = [
      ...inputData.riskAssessment.recommendations,
      'Follow up with healthcare provider',
      'Monitor symptoms closely'
    ];
    
    const nextSteps = inputData.requiresImmediateCare ? 
      ['Seek immediate medical attention', 'Call emergency services if needed'] :
      ['Schedule doctor appointment', 'Continue monitoring symptoms'];
    
    return {
      recommendations,
      nextSteps,
      summary: recommendationResponse.text || 'Recommendations generated successfully'
    };
  }
});

// Assemble the workflow
healthAssessmentWorkflow
  .then(triageStep)
  .then(assessmentStep)
  .then(recommendationStep)
  .commit();

// Workflow 2: Emergency Response Workflow
export const emergencyResponseWorkflow = createWorkflow({
  id: 'emergency-response',
  description: 'Emergency response workflow for urgent health situations',
  inputSchema: z.object({
    patientId: z.string(),
    emergencyType: z.string(),
    location: z.string().optional(),
    contactInfo: z.string().optional()
  }),
  outputSchema: z.object({
    response: z.object({
      action: z.string(),
      urgency: z.string(),
      instructions: z.array(z.string()),
      contactInfo: z.string()
    })
  })
});

const emergencyTriageStep = createStep({
  id: 'emergency-triage',
  description: 'Emergency triage and immediate response',
  inputSchema: z.object({
    emergencyType: z.string(),
    location: z.string().optional()
  }),
  outputSchema: z.object({
    action: z.string(),
    urgency: z.string(),
    instructions: z.array(z.string()),
    contactInfo: z.string()
  }),
  execute: async ({ inputData }) => {
    console.log('🚨 Emergency triage activated...');
    
    const emergencyInstructions = [
      'Call emergency services immediately',
      'Stay calm and follow safety protocols',
      'Provide clear information to responders',
      'Do not move the patient unless in immediate danger'
    ];
    
    return {
      action: 'immediate_emergency_response',
      urgency: 'critical',
      instructions: emergencyInstructions,
      contactInfo: 'Call 911 or local emergency services'
    };
  }
});

emergencyResponseWorkflow
  .then(emergencyTriageStep)
  .commit();

// Test function for workflows
if (import.meta.url === `file://${process.argv[1]}`) {
  async function testWorkflows() {
    console.log('🧪 Testing Health Workflows...\n');
    
    // Test 1: Complete Health Assessment
    console.log('📋 Test 1: Complete Health Assessment Workflow');
    const assessmentRun = healthAssessmentWorkflow.createRun();
    
    try {
      const assessmentResult = await assessmentRun.start({
        inputData: {
          patientId: 'patient-001',
          symptoms: 'chest pain and shortness of breath',
          duration: '2 hours',
          severity: 'severe',
          age: 45,
          medicalHistory: 'hypertension',
          lifestyle: 'moderate'
        }
      });
      
      console.log('✅ Assessment Result:', JSON.stringify(assessmentResult, null, 2));
    } catch (error) {
      console.error('❌ Assessment Error:', error);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 2: Emergency Response
    console.log('🚨 Test 2: Emergency Response Workflow');
    const emergencyRun = emergencyResponseWorkflow.createRun();
    
    try {
      const emergencyResult = await emergencyRun.start({
        inputData: {
          patientId: 'patient-002',
          emergencyType: 'cardiac emergency',
          location: 'home',
          contactInfo: '555-0123'
        }
      });
      
      console.log('✅ Emergency Result:', JSON.stringify(emergencyResult, null, 2));
    } catch (error) {
      console.error('❌ Emergency Error:', error);
    }
    
    console.log('\n🎉 Workflow testing complete!');
  }
  
  testWorkflows().catch(console.error);
}
