### High-level integration plan (aligned to `docs/demo-architecture.md`)

- Objective: Integrate a Mastra agent that:
  - Reads/writes `HealthState` only via `AgentBridge` tools
  - Streams responses into `ChatPanel`
  - Augments engine outputs with external evidence (search) when helpful
  - Follows the UI-is-store-driven rule; agent never mutates UI directly

## 1) Mastra runtime layout in `src/mastra/`
- Create:
  - `src/mastra/agents/health-agent.ts`: Main agent definition (Gemini/OpenAI).
  - `src/mastra/tools/`:
    - `bridge-read.ts`: read-only tools that wrap `Agent.read*` from `AgentBridge.ts`.
    - `bridge-write.ts`: mutation tools that wrap `Agent.addFinding/removeFinding/applyActionOutcome/...`.
    - `external-search.ts`: web search (provider-based; configurable).
    - `clinical-content.ts`: curated content retriever (guidelines, condition summaries).
  - `src/mastra/workflows/health.ts`: triage → assessment → recommendations (invokes tools).
  - `src/mastra/index.ts`: `new Mastra({ agents, tools, workflows, memory, logger })`.

Notes:
- Use `@mastra/core/agent` and provider from AI SDK (`@ai-sdk/google` or `@ai-sdk/openai`), matching Lesson 2/3 patterns.
- Configure memory (`@mastra/memory` + `@mastra/libsql`), disable semantic recall initially (no vector store), leave a flag to enable later.

## 2) AgentBridge-backed tools
- Purpose: enforce the “app state is the source of truth”:
  - Read tools:
    - `readHealthState` (structured summary); `readTopConditions`; `readActionRanking`; `readActionMap`; `readConditionInformation(conditionId)`.
  - Mutation tools:
    - `addFinding({ id, presence, value? })`
    - `removeFinding({ id })`
    - `applyActionOutcome({ actionId, outcomeId })`
    - `updatePatientData(patientData)`
- Design:
  - Validate params with Zod.
  - Return concise DTOs for agent consumption (don’t leak the entire store).
  - Log mutations; ensure recompute rules are triggered by the store.

## 3) External tools
- Web search tool:
  - Provider options: `@ai-sdk/google` web, `openrouter`, or custom Bing/SerpAPI fetcher.
  - Input: condition IDs/labels and user context.
  - Output: list of sources { title, url, summary, credibility hints }.
  - Controls: allow/deny-list domains; optional “clinical-only” mode.
- Clinical content tool:
  - Fetch curated condition sheets (internal `src/content/`, or public guideline endpoints).
  - Normalize to structured sections: red flags, when to seek care, self-care, follow-up.
- Safety:
  - Add a moderation/output-processor to prevent prescriptive medical advice; always append disclaimers.

## 4) Workflows
- `healthAssessmentWorkflow`:
  - Step 1: triage via `readHealthState`, `readTopConditions`; prompt model to decide if urgent; tool call for severity check.
  - Step 2: assessment: may call `readConditionInformation` and `external-search` if confidence low or info gain high.
  - Step 3: recommendation: propose actions using `readActionRanking`; optionally call `getActionOutcomes` and present options.
  - Step 4: apply: with user confirmation, call `applyActionOutcome`.
- Optional: “Profile memory” step using Mastra memory per resource/thread for personalization.

## 5) API surface for UI
- New endpoints:
  - `POST /api/agent/chat`:
    - Request: { messages | prompt, threadId, resourceId }
    - Returns SSE/text stream (or chunked JSON) for agent response.
  - `POST /api/agent/action`:
    - Broker endpoint to call a specific tool on behalf of the UI when needed (rare; prefer agent).
- Implementation:
  - Use Mastra server or an edge route.
  - Thread/resource IDs come from the session/user; store in memory for context.

## 6) `ChatPanel.tsx` integration
- Replace current POST `/api/chat` with `/api/agent/chat`.
- Stream handler:
  - Show incremental text in the chat.
  - Surface “tool activity” breadcrumbs in the UI (optional): “Checking actions…”, “Consulting external sources…”.
- State coupling:
  - The store mutates solely via `AgentBridge` tools triggered inside the agent.
  - After each agent turn, UI re-renders from the store automatically (Zustand subscriptions already do this).

## 7) Prompts and behaviors
- Agent system instructions:
  - Follow demo-architecture: never mutate UI; only use AgentBridge tools for state changes.
  - Safety-first triage; prescriptive advice replaced with categories (supportive care, watchful waiting, see clinician).
  - Evidence-seeking behavior:
    - If top condition certainty < threshold, call external-search for reputable sources and summarize.
- Tool choice policy:
  - Use `toolChoice: auto` but constrain to bridge/external tools.
  - Encourage calling `getActionOutcomes` before recommending user-visible action.

## 8) Observability and safeguards
- Logging:
  - Configure `@mastra/loggers` to console in dev.
  - Log tool calls, workflow step starts/finishes (ids; timings).
- Guards:
  - Output processors for moderation (Mastra processors) with “block/warn” strategies.
  - Rate limiting in API routes; optional auth gate for write tools.
  - PHI scrubbing before external web search.

## 9) Environment and config
- `.env`:
  - AI provider keys (`GOOGLE_GENERATIVE_AI_API_KEY` or `OPENAI_API_KEY`).
  - Search provider API key if using external service.
  - LIBSQL file DSN for memory.
- Feature flags:
  - `AGENT_ENABLED`, `WEB_SEARCH_ENABLED`, `CLINICAL_ONLY_MODE`.
- Scripts:
  - `npm run agent:dev` to launch Mastra dev server (optional) or Next dev start.

## 10) Testing
- Unit:
  - Tools: read/write bridge tools (mock store), external-search adapters.
  - Workflows: step inputs/outputs with fixtures.
- Integration:
  - API route returns streaming chunks; ChatPanel handles stream and displays text.
  - Tool-triggered store mutations reflected in UI.

## 11) Rollout strategy
- Phase 1: Read-only agent (no write tools) to validate UX.
- Phase 2: Enable write tools behind flag; add confirmation UI for mutations.
- Phase 3: Enable external search in non-clinical mode; add curated-domain list.

### Deliverables map to code
- `src/mastra/index.ts` initializes Mastra runtime.
- `src/mastra/agents/health-agent.ts` defines agent with tools and memory.
- `src/mastra/tools/bridge-read.ts`, `bridge-write.ts`, `external-search.ts`, `clinical-content.ts`.
- `src/mastra/workflows/health.ts` orchestrates triage→assessment→recommendations.
- `src/app/api/agent/chat/route.ts` and optional `src/app/api/agent/action/route.ts`.
- `src/components/ChatPanel.tsx` streams from `/api/agent/chat`.

### Minimal risks and mitigations
- Model/provider mismatches: lock provider and model IDs; test `generateVNext` path.
- ESM/import issues: preserve `.ts` usage with proper tsconfig (`module: ES2022`, `moduleResolution: node`).
- Safety: always return non-prescriptive categories; add moderation processor.

If you’re good with this plan, I can scaffold `src/mastra/` (agents, tools, workflows) and the `/api/agent/chat` route, then wire up `ChatPanel.tsx` to stream from the agent.