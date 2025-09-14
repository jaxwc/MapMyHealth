/**
 * Lesson 2: Enhanced Health Agent with Tools
 * 
 * This agent demonstrates how to integrate custom tools with Mastra agents
 * for more powerful and interactive health assistance.
 */

import 'dotenv/config';
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// Define tools directly in this file to avoid import issues
const symptomCheckerTool = createTool({
  id: 'symptom-checker',
  description: 'Analyzes symptoms and provides initial health guidance',
  inputSchema: z.object({
    symptoms: z.string().describe('The symptoms to analyze (e.g., "headache, fever, fatigue")'),
    duration: z.string().optional().describe('How long the symptoms have been present'),
    severity: z.enum(['mild', 'moderate', 'severe']).optional().describe('Severity level of symptoms')
  }),
  execute: async ({ context }) => {
    const { symptoms, duration, severity } = context;
    
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

const medicationLookupTool = createTool({
  id: 'medication-lookup',
  description: 'Looks up information about medications and their interactions',
  inputSchema: z.object({
    medication: z.string().describe('Name of the medication to look up'),
    currentMedications: z.array(z.string()).optional().describe('List of current medications for interaction checking')
  }),
  execute: async ({ context }) => {
    const { medication, currentMedications = [] } = context;
    
    const medicationInfo = {
      name: medication,
      commonUses: ['Pain relief', 'Fever reduction', 'Anti-inflammatory'],
      sideEffects: ['Nausea', 'Dizziness', 'Stomach upset'],
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

const healthTipsTool = createTool({
  id: 'health-tips',
  description: 'Generates personalized health tips based on user profile',
  inputSchema: z.object({
    age: z.number().optional().describe('User age'),
    lifestyle: z.enum(['sedentary', 'moderate', 'active']).optional().describe('Activity level'),
    healthGoals: z.array(z.string()).optional().describe('Health goals (e.g., weight loss, better sleep)')
  }),
  execute: async ({ context }) => {
    const { age, lifestyle, healthGoals = [] } = context;
    
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

const healthTools = {
  symptomChecker: symptomCheckerTool,
  medicationLookup: medicationLookupTool,
  healthTips: healthTipsTool
};

// Create an enhanced health agent with tools
export const enhancedHealthAgent = new Agent({
  name: 'Enhanced Health Assistant',
  instructions: `You are an advanced health assistant with access to specialized tools. You can:

  - Analyze symptoms using the symptom checker tool
  - Look up medication information and interactions
  - Generate personalized health tips based on user profiles
  - Provide comprehensive health guidance
  
  Guidelines:
  - Always use the appropriate tool when users ask about symptoms, medications, or health tips
  - Explain what you're doing when using tools
  - Combine tool results with your medical knowledge for better responses
  - Always remind users that you're not a substitute for professional medical advice
  - For serious symptoms, recommend consulting a healthcare provider immediately
  - Be empathetic and supportive in your responses`,
  
  model: google('gemini-2.5-flash'),
  tools: healthTools
});

// Enhanced usage function with better error handling
export async function chatWithEnhancedAgent(userMessage: string) {
  try {
    console.log(`\n🤖 Enhanced Health Agent processing: "${userMessage}"`);
    
    const result = await enhancedHealthAgent.generateVNext(userMessage);
    
    if (result?.text) {
      console.log(`✅ Agent response: ${result.text}`);
      return result.text;
    } else {
      console.log('⚠️ No text response received');
      return 'I received your message but couldn\'t generate a response. Please try again.';
    }
  } catch (error) {
    console.error('❌ Error chatting with enhanced health agent:', error);
    return 'Sorry, I encountered an error while processing your request. Please try again.';
  }
}

// Test function for the enhanced agent
if (import.meta.url === `file://${process.argv[1]}`) {
  async function testEnhancedAgent() {
    console.log('🧪 Testing Enhanced Health Agent with Tools...\n');
    
    const testScenarios = [
      {
        name: "Symptom Analysis",
        message: "I have a headache and fever that started yesterday. The pain is severe."
      },
      {
        name: "Medication Lookup", 
        message: "Can you tell me about ibuprofen? I'm also taking aspirin."
      },
      {
        name: "Health Tips",
        message: "I'm 35, moderately active, and want to improve my sleep and lose some weight."
      },
      {
        name: "General Health Question",
        message: "What should I do if I feel dizzy after standing up?"
      }
    ];
    
    for (const scenario of testScenarios) {
      console.log(`\n📋 Test: ${scenario.name}`);
      console.log(`User: ${scenario.message}`);
      
      const response = await chatWithEnhancedAgent(scenario.message);
      console.log(`Agent: ${response}`);
      
      // Add a small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n🎉 Enhanced agent testing complete!');
  }
  
  testEnhancedAgent().catch(console.error);
}
