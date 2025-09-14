/**
 * Lesson 1: Build Your First Agent
 * 
 * This is your first Mastra agent - a health assistant that can help users
 * with basic health questions and wellness advice.
 */

import 'dotenv/config';
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';

// Create your first agent
const healthAgent = new Agent({
  name: 'Health Assistant',
  instructions: `You are a helpful health assistant. You can:
  
  - Answer basic health-related questions
  - Provide general wellness advice
  - Help users understand their symptoms
  - Suggest when to seek professional medical help
  
  Important guidelines:
  - Always remind users that you're not a substitute for professional medical advice
  - For serious symptoms, recommend consulting a healthcare provider
  - Be empathetic and supportive in your responses
  - Keep responses clear and easy to understand`,
  
  model: google('gemini-2.5-flash')
});

// Example usage function
export async function chatWithHealthAgent(userMessage: string) {
  try {
    const result = await healthAgent.generateVNext(userMessage);
    return result?.text ?? '';
  } catch (error) {
    console.error('Error chatting with health agent:', error);
    return 'Sorry, I encountered an error. Please try again.';
  }
}

// Export the agent for use in other parts of your application
export { healthAgent };

// Example: Test the agent
if (import.meta.url === `file://${process.argv[1]}`) {
  async function testAgent() {
    console.log('Testing Health Agent...\n');
    
    const testQuestions = [
      "I have a headache. What should I do?",
      "What are some ways to improve my sleep?",
      "I feel tired all the time. Is this normal?"
    ];
    
    for (const question of testQuestions) {
      console.log(`User: ${question}`);
      const response = await chatWithHealthAgent(question);
      console.log(`Agent: ${response}\n`);
    }
  }
  
  testAgent().catch(console.error);
}
