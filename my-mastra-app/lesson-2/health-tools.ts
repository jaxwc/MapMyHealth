/**
 * Lesson 2: Adding Tools and MCP
 * 
 * This lesson shows how to create custom tools for your Mastra agent
 * and integrate them with external services.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// Tool 1: Symptom Checker
export const symptomCheckerTool = createTool({
  id: 'symptom-checker',
  description: 'Analyzes symptoms and provides initial health guidance',
  inputSchema: z.object({
    symptoms: z.string().describe('The symptoms to analyze (e.g., "headache, fever, fatigue")'),
    duration: z.string().optional().describe('How long the symptoms have been present'),
    severity: z.enum(['mild', 'moderate', 'severe']).optional().describe('Severity level of symptoms')
  }),
  execute: async ({ context }) => {
    const { symptoms, duration, severity } = context;
    
    // Simulate symptom analysis (in a real app, this would call a medical API)
    const analysis = {
      symptoms: symptoms.split(',').map(s => s.trim()),
      duration: duration || 'unknown',
      severity: severity || 'moderate',
      recommendations: [
        'Rest and stay hydrated',
        'Monitor symptoms closely',
        'Seek medical attention if symptoms worsen'
      ],
      urgency: severity === 'severe' ? 'high' : 'low',
      timestamp: new Date().toISOString()
    };
    
    return {
      analysis,
      message: `Analyzed ${analysis.symptoms.length} symptoms. Urgency level: ${analysis.urgency}`
    };
  }
});

// Tool 2: Medication Lookup
export const medicationLookupTool = createTool({
  id: 'medication-lookup',
  description: 'Looks up information about medications and their interactions',
  inputSchema: z.object({
    medication: z.string().describe('Name of the medication to look up'),
    currentMedications: z.array(z.string()).optional().describe('List of current medications for interaction checking')
  }),
  execute: async ({ context }) => {
    const { medication, currentMedications = [] } = context;
    
    // Simulate medication lookup (in a real app, this would call a pharmacy API)
    const medicationInfo = {
      name: medication,
      commonUses: [
        'Pain relief',
        'Fever reduction',
        'Anti-inflammatory'
      ],
      sideEffects: [
        'Nausea',
        'Dizziness',
        'Stomach upset'
      ],
      interactions: currentMedications.length > 0 ? 
        [`May interact with ${currentMedications.join(', ')}`] : 
        ['No known interactions with provided medications'],
      dosage: 'Follow doctor\'s instructions',
      warnings: [
        'Do not exceed recommended dosage',
        'Consult doctor if pregnant or breastfeeding'
      ]
    };
    
    return {
      medication: medicationInfo,
      message: `Found information for ${medication}. ${medicationInfo.interactions.length} interaction(s) noted.`
    };
  }
});

// Tool 3: Health Tips Generator
export const healthTipsTool = createTool({
  id: 'health-tips',
  description: 'Generates personalized health tips based on user profile',
  inputSchema: z.object({
    age: z.number().optional().describe('User age'),
    lifestyle: z.enum(['sedentary', 'moderate', 'active']).optional().describe('Activity level'),
    healthGoals: z.array(z.string()).optional().describe('Health goals (e.g., weight loss, better sleep)')
  }),
  execute: async ({ context }) => {
    const { age, lifestyle, healthGoals = [] } = context;
    
    // Generate personalized tips
    const tips = [];
    
    if (age && age > 50) {
      tips.push('Consider regular health screenings');
    }
    
    if (lifestyle === 'sedentary') {
      tips.push('Try to incorporate 30 minutes of daily activity');
    } else if (lifestyle === 'active') {
      tips.push('Maintain your active lifestyle - you\'re doing great!');
    }
    
    if (healthGoals.includes('weight loss')) {
      tips.push('Focus on portion control and regular exercise');
    }
    
    if (healthGoals.includes('better sleep')) {
      tips.push('Maintain a consistent sleep schedule and avoid screens before bed');
    }
    
    // Default tips if no specific goals
    if (tips.length === 0) {
      tips.push('Stay hydrated throughout the day');
      tips.push('Get 7-9 hours of sleep nightly');
      tips.push('Eat a balanced diet with fruits and vegetables');
    }
    
    return {
      tips,
      personalized: true,
      message: `Generated ${tips.length} personalized health tips for you`
    };
  }
});

// Export all tools
export const healthTools = {
  symptomChecker: symptomCheckerTool,
  medicationLookup: medicationLookupTool,
  healthTips: healthTipsTool
};
