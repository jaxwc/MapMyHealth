# Mastra 101 Course Guide

Welcome to the Mastra 101 course! This interactive course will teach you how to build and deploy AI agents using the Mastra framework.

## 🎯 Course Progress

### ✅ Completed
- [x] Course setup and structure
- [x] Lesson 1: Basic agent creation
- [x] Health assistant agent example

### 🔄 In Progress
- [ ] Install dependencies and test agent

### 📋 Upcoming Lessons
- [ ] Lesson 2: Adding Tools and MCP
- [ ] Lesson 3: Adding Memory
- [ ] Lesson 4: Building Workflows

## 🚀 Getting Started

### Step 1: Install Dependencies
```bash
cd my-mastra-app
npm install
```

### Step 2: Set Up Environment
1. Copy `env.example` to `.env`
2. Add your OpenAI API key to `.env`
3. Get your API key from: https://platform.openai.com/api-keys

### Step 3: Test Your First Agent
```bash
npm run lesson1
```

## 📚 Lesson Overview

### Lesson 1: Build Your First Agent ✅
**What you learned:**
- Created a basic health assistant agent
- Configured system prompts
- Set up agent structure
- Added error handling

**Files created:**
- `lesson-1/health-agent.ts` - Your first agent
- `lesson-1/README.md` - Lesson documentation

### Lesson 2: Adding Tools and MCP (Coming Next)
**What you'll learn:**
- Integrate external services using MCP servers
- Add custom tools to your agent
- Connect to APIs and databases
- Handle tool responses

### Lesson 3: Adding Memory
**What you'll learn:**
- Implement conversation memory
- Store user preferences
- Create personalized responses
- Manage context across sessions

### Lesson 4: Building Workflows
**What you'll learn:**
- Orchestrate multiple agents
- Create sequential and parallel workflows
- Handle conditional logic
- Build complex automation

## 🛠️ Development Tips

1. **Start Simple**: Begin with basic functionality and add complexity gradually
2. **Test Often**: Test your agent after each change
3. **Read Documentation**: Check Mastra docs for advanced features
4. **Experiment**: Try different prompts and configurations

## 📖 Resources

- [Mastra Documentation](https://mastra.ai/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🆘 Need Help?

If you encounter issues:
1. Check the error messages carefully
2. Verify your API keys are correct
3. Ensure all dependencies are installed
4. Review the code examples in each lesson

Ready to continue? Let's move on to Lesson 2!
