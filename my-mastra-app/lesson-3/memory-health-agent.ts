/**
 * Lesson 3: Memory-Enabled Health Agent
 * 
 * This agent demonstrates how to add memory capabilities to Mastra agents
 * for persistent conversations and personalized health assistance.
 */

import 'dotenv/config';
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';

// Set up memory storage
const storage = new LibSQLStore({
  url: 'file:./health-agent-memory.db'
});

const memory = new Memory({
  storage,
  options: {
    lastMessages: 10, // Keep last 10 messages in context
    semanticRecall: false, // Disable semantic recall for now (requires vector store)
    workingMemory: {
      enabled: true // Enable working memory for temporary context
    }
  }
});

// Enhanced tools with memory awareness
const profileManagerTool = createTool({
  id: 'profile-manager',
  description: 'Manages user health profiles and preferences',
  inputSchema: z.object({
    action: z.enum(['get', 'update', 'create']).describe('Action to perform on profile'),
    data: z.object({
      age: z.number().optional(),
      lifestyle: z.enum(['sedentary', 'moderate', 'active']).optional(),
      healthGoals: z.array(z.string()).optional(),
      allergies: z.array(z.string()).optional(),
      medications: z.array(z.string()).optional()
    }).optional().describe('Profile data to update')
  }),
  execute: async ({ context }, options) => {
    const { action, data } = context;
    const threadId = options?.threadId || 'default';
    
    try {
      if (action === 'get') {
        // Retrieve existing profile from memory
        const profile = await memory.getWorkingMemory(threadId, 'user_profile');
        return {
          profile: profile || {},
          message: profile ? 'Retrieved existing profile' : 'No profile found'
        };
      } else if (action === 'update' || action === 'create') {
        // Store/update profile in memory
        await memory.setWorkingMemory(threadId, 'user_profile', data);
        return {
          profile: data,
          message: 'Profile updated successfully'
        };
      }
    } catch (error) {
      return {
        error: 'Failed to manage profile',
        message: 'There was an error managing your profile'
      };
    }
  }
});

const conversationSummaryTool = createTool({
  id: 'conversation-summary',
  description: 'Provides a summary of previous conversations',
  inputSchema: z.object({
    topic: z.string().optional().describe('Specific topic to summarize')
  }),
  execute: async ({ context }, options) => {
    const { topic } = context;
    const threadId = options?.threadId || 'default';
    
    try {
      // Get recent conversation history
      const messages = await memory.getMessages(threadId, { limit: 20 });
      
      if (messages.length === 0) {
        return {
          summary: 'No previous conversations found',
          message: 'This is your first conversation with the health assistant'
        };
      }
      
      // Filter by topic if specified
      const relevantMessages = topic ? 
        messages.filter(msg => 
          msg.content.toLowerCase().includes(topic.toLowerCase())
        ) : messages;
      
      const summary = {
        totalMessages: messages.length,
        relevantMessages: relevantMessages.length,
        topics: [...new Set(messages.map(msg => 
          msg.content.split(' ').slice(0, 3).join(' ')
        ))],
        lastInteraction: messages[messages.length - 1]?.createdAt,
        keyConcerns: relevantMessages.slice(-5).map(msg => msg.content.substring(0, 100))
      };
      
      return {
        summary,
        message: `Found ${summary.totalMessages} previous messages, ${summary.relevantMessages} relevant to "${topic || 'general'}"`
      };
    } catch (error) {
      return {
        error: 'Failed to generate summary',
        message: 'Unable to access conversation history'
      };
    }
  }
});

const personalizedRecommendationsTool = createTool({
  id: 'personalized-recommendations',
  description: 'Generates personalized health recommendations based on user profile and history',
  inputSchema: z.object({
    focusArea: z.string().optional().describe('Specific area to focus recommendations on')
  }),
  execute: async ({ context }, options) => {
    const { focusArea } = context;
    const threadId = options?.threadId || 'default';
    
    try {
      // Get user profile
      const profile = await memory.getWorkingMemory(threadId, 'user_profile') || {};
      
      // Get conversation history for context
      const messages = await memory.getMessages(threadId, { limit: 10 });
      
      const recommendations = [];
      
      // Age-based recommendations
      if (profile.age) {
        if (profile.age > 50) {
          recommendations.push('Consider regular health screenings and bone density tests');
        } else if (profile.age < 30) {
          recommendations.push('Focus on building healthy habits early');
        }
      }
      
      // Lifestyle-based recommendations
      if (profile.lifestyle === 'sedentary') {
        recommendations.push('Start with 15-minute daily walks and gradually increase activity');
      } else if (profile.lifestyle === 'active') {
        recommendations.push('Maintain your active lifestyle and consider cross-training');
      }
      
      // Health goals
      if (profile.healthGoals?.includes('weight loss')) {
        recommendations.push('Focus on sustainable calorie deficit and strength training');
      }
      if (profile.healthGoals?.includes('better sleep')) {
        recommendations.push('Establish a consistent bedtime routine and limit screen time before bed');
      }
      
      // Conversation history insights
      const recentTopics = messages.slice(-5).map(msg => msg.content.toLowerCase());
      if (recentTopics.some(topic => topic.includes('stress'))) {
        recommendations.push('Consider stress management techniques like meditation or deep breathing');
      }
      if (recentTopics.some(topic => topic.includes('pain'))) {
        recommendations.push('Consult with a healthcare provider about pain management strategies');
      }
      
      // Focus area specific recommendations
      if (focusArea) {
        recommendations.push(`For ${focusArea}: Consider consulting a specialist for targeted advice`);
      }
      
      return {
        recommendations,
        profile: profile,
        basedOn: {
          profile: Object.keys(profile).length > 0,
          conversationHistory: messages.length,
          focusArea: !!focusArea
        },
        message: `Generated ${recommendations.length} personalized recommendations`
      };
    } catch (error) {
      return {
        error: 'Failed to generate recommendations',
        message: 'Unable to access your profile or history'
      };
    }
  }
});

// Create memory-enabled health agent
export const memoryHealthAgent = new Agent({
  name: 'Memory Health Assistant',
  instructions: `You are an advanced health assistant with memory capabilities. You can:

  - Remember user profiles and preferences across conversations
  - Provide personalized recommendations based on history
  - Summarize previous conversations
  - Build long-term health relationships with users
  
  Guidelines:
  - Always use the profile manager to store and retrieve user information
  - Reference previous conversations when relevant
  - Provide personalized advice based on user history
  - Use conversation summary tool to understand context
  - Generate personalized recommendations using user profile and history
  - Always remind users that you're not a substitute for professional medical advice
  - Be empathetic and supportive, building on previous interactions`,
  
  model: google('gemini-2.5-flash'),
  memory,
  tools: {
    profileManager: profileManagerTool,
    conversationSummary: conversationSummaryTool,
    personalizedRecommendations: personalizedRecommendationsTool
  }
});

// Enhanced usage function with memory management
export async function chatWithMemoryAgent(userMessage: string, threadId: string = 'user-123') {
  try {
    console.log(`\n🧠 Memory Health Agent processing: "${userMessage}"`);
    console.log(`📝 Thread ID: ${threadId}`);
    
    const result = await memoryHealthAgent.generateVNext(userMessage, {
      memory: {
        thread: threadId,
        resource: 'health-assistant'
      }
    });
    
    if (result?.text) {
      console.log(`✅ Agent response: ${result.text}`);
      return result.text;
    } else {
      console.log('⚠️ No text response received');
      return 'I received your message but couldn\'t generate a response. Please try again.';
    }
  } catch (error) {
    console.error('❌ Error chatting with memory health agent:', error);
    return 'Sorry, I encountered an error while processing your request. Please try again.';
  }
}

// Test function for the memory-enabled agent
if (import.meta.url === `file://${process.argv[1]}`) {
  async function testMemoryAgent() {
    console.log('🧪 Testing Memory Health Agent...\n');
    
    const testThreadId = 'test-user-456';
    
    const testScenarios = [
      {
        name: "Profile Setup",
        message: "Hi, I'm Sarah, I'm 28 years old, moderately active, and I want to improve my sleep and manage stress better."
      },
      {
        name: "Follow-up Question",
        message: "What are some good stress management techniques for someone like me?"
      },
      {
        name: "Memory Recall",
        message: "Can you remind me what we discussed about my health goals?"
      },
      {
        name: "Personalized Recommendations",
        message: "Give me some personalized health recommendations based on my profile."
      },
      {
        name: "Conversation Summary",
        message: "Can you summarize our conversation so far?"
      }
    ];
    
    for (const scenario of testScenarios) {
      console.log(`\n📋 Test: ${scenario.name}`);
      console.log(`User: ${scenario.message}`);
      
      const response = await chatWithMemoryAgent(scenario.message, testThreadId);
      console.log(`Agent: ${response}`);
      
      // Add a small delay between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n🎉 Memory agent testing complete!');
    console.log('💾 Check the database file: health-agent-memory.db');
  }
  
  testMemoryAgent().catch(console.error);
}
