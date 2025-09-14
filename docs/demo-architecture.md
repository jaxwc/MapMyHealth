### Goal
Build an application state layer that owns a `HealthState` and is the single source of truth for the UI and the future AI agent. The domain engine consumes `{ knownFindings, patientData }` and returns `{ rankedConditions, importantUnknowns, actionMap }`. Treatments are agent-populated and cleared on state changes.

### High-level architecture
- **Application state (Zustand store)**: `HealthState` + actions/selectors. UI subscribes to it. Agent reads/mutates it.
- **Engine facade (adapter over src/engine)**: Pure function(s) that evaluate `{ knownFindings, patientData }` against `@content/` to produce `{ rankedConditions, importantUnknowns, actionMap }`.
- **PatientHealthService**: Provides `patientData` and streams updates when available.
- **Agent bridge **: Read-only helpers and mutation APIs mapped to store actions.
- **UI**: `@top.tsx` and `@bottom.tsx` render from store only. No direct AI calls.
- **API**: Deprecate `src/app/api/chat/route.tsx` for UI usage; keep or replace for agent-only utilities if needed.

### Data model
```ts
// Types are illustrative; align to src/engine/types.ts where possible.
export type FindingId = string;
export type ConditionId = string;
export type ActionId = string;

export interface PatientData {
  demographics?: { age?: number; sexAtBirth?: "male" | "female" | "other" };
  vitals?: Record<string, number | string>;
  labs?: Record<string, number | string>;
  history?: Record<string, unknown>;
  medications?: string[];
  allergies?: string[];
}

export interface KnownFinding {
  id: FindingId;
  presence: "present" | "absent"; // align with engine CaseState.findings
  value?: unknown;           // e.g., boolean, enum, numeric; align with engine schema
  onset?: string;            // ISO date or relative (optional)
  daysSinceOnset?: number;   // align with engine effects
  severity?: string;         // optional domain scale
  source?: "user" | "agent" | "patientData" | "system";
}

export interface RankedCondition {
  id: ConditionId;
  name: string;
  score: number;             // probability or rank score
  rationale?: string;        // optional explanation from engine
}

export interface UnknownQuestion {
  id: FindingId;
  prompt: string;
  impact: "high" | "medium" | "low"; // prioritization
  rationale?: string; // align with viewModel.mostInformativeUnknowns
}

export interface ActionOutcome {
  outcomeId: string;
  description: string;
  affects: {
    findings?: Array<{ id: FindingId; effect: "confirm" | "refute" | "quantify" }>;
    conditions?: Array<{ id: ConditionId; deltaScore: number }>;
  };
  nextSteps?: string[];
}

export interface ActionMap {
  catalog: Record<ActionId, { name: string; outcomes: ActionOutcome[] }>;
  // Unified tree/graph representation for visualization and planning
  root: { label: string };
  transitions: Array<{
    actionId: ActionId;
    actionLabel: string;
    outcomes: Array<{
      outcomeId: string;
      label: string;
      probEstimate: number;
      to: { label: string };
    }>;
  }>;
}

export interface TreatmentRecommendation {
  generatedAt: string;
  rationale?: string;
  recommendations: Array<{
    conditionId: ConditionId;
    title: string;
    details?: string;
    strength?: "A" | "B" | "C"; // optional guideline strength
  }>;
}

export interface CostWeights {
  infoGainWeight: number;
  money: number;
  timeHours: number;
  difficulty: number;
  risk: number;
}

export interface HealthState {
  knownFindings: KnownFinding[];
  rankedConditions: RankedCondition[];
  importantUnknowns: UnknownQuestion[];
  actionMap: ActionMap;
  patientData: PatientData | null;
  treatmentRecommendation?: TreatmentRecommendation; // cleared on state changes
  lastEvaluatedAt?: string;
  // Additions to match current engine game features
  triage?: { urgent: boolean; flags?: string[] };
  engineRecommendation?: string; // from engine for hackathon speed
  costWeights?: CostWeights;     // user preference weights that influence action utility
  completedActions?: Array<{ actionId: ActionId; outcomeId: string; at: string }>; // history
}
```

### Engine facade (adapter over `src/engine`)
- Keep the engine pure and deterministic; load/compile `@content/` once, then evaluate quickly.
- Provide a single entry-point:
```ts
// src/engine/facade.ts
export interface EngineInputs {
  knownFindings: KnownFinding[];
  patientData: PatientData | null;
  costWeights?: CostWeights; // influences action ranking/utility
}

export interface ActionRankingItem {
  actionId: ActionId;
  label: string;
  expectedInfoGain: number;
  costs: { money: number; timeHours: number; difficulty: number; risk: number };
  utility: number;
}

export interface EngineOutputs {
  rankedConditions: RankedCondition[];
  importantUnknowns: UnknownQuestion[];
  actionMap: ActionMap; // unified catalog + transitions for visualization and step-planning
  actionRanking: ActionRankingItem[]; // ordered by utility
  triage: { urgent: boolean; flags?: string[] };
  engineRecommendation: string; // use engine's text directly for hackathon speed
}

export interface EngineFacade {
  evaluate(inputs: EngineInputs): Promise<EngineOutputs>;
  getConditionGraph(conditionId: ConditionId): Promise<any>; // full JSON + dependencies from @content
  getActionOutcomes(actionId: ActionId): Promise<Array<{ outcomeId: string; label: string; probEstimate: number; effects: any }>>; // effects include finding presence/value updates
}

export function createEngineFacade(): Promise<EngineFacade>;
```
- Internally:
  - Load and parse `src/content/*.json`.
  - If needed, compile/pre-index content (using `compiler.ts`).
  - Compute influence/beliefs/planner/triage to return outputs (`influence.ts`, `beliefs.ts`, `planner.ts`, `triage.ts`).
  - Preserve existing domain logic but re-expose as `evaluate()` that only depends on inputs and content.

### Application state (Zustand store)
- Store file: `src/app/state/healthStore.ts`
- Responsibilities:
  - Hold `HealthState`.
  - Provide mutations: add/remove findings, set patient data, recompute engine outputs, set/clear treatments.
  - Clear `treatmentRecommendation` whenever `knownFindings` or `patientData` changes.
  - Optionally persist to storage (for dev) and expose selectors for UI.
  - Manage `costWeights` preferences and trigger re-evaluation when they change.
  - Track `completedActions` and support applying action outcomes that mutate findings and history.

```ts
// src/app/state/healthStore.ts
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { createEngineFacade } from "@/engine/facade";
import type { HealthState, KnownFinding, PatientData, ActionId, TreatmentRecommendation } from "./types";

interface HealthCommands {
  init(patientId?: string): Promise<void>; // loads patient data, evaluates
  addFinding(f: KnownFinding): Promise<void>;
  removeFinding(id: string): Promise<void>;
  setPatientData(p: PatientData): Promise<void>;
  recompute(): Promise<void>;
  clearTreatmentRecommendation(): void;
  setTreatmentRecommendation(t: TreatmentRecommendation): void;
  getActionOutcomes(actionId: ActionId): { outcomes: any[] } | null;
  setCostWeights(w: CostWeights): Promise<void>;
  applyActionOutcome(actionId: ActionId, outcomeId: string): Promise<void>; // updates findings and completedActions
}

type HealthStore = HealthState & HealthCommands;

export const useHealthStore = create<HealthStore>()(subscribeWithSelector((set, get) => {
  let enginePromise: Promise<ReturnType<typeof createEngineFacade>> | null = null;
  const getEngine = async () => enginePromise ??= createEngineFacade();

  const clearTreatmentsOnChange = () => {
    const { treatmentRecommendation } = get();
    if (treatmentRecommendation) set({ treatmentRecommendation: undefined });
  };

  const recompute = async () => {
    const engine = await getEngine();
    const { knownFindings, patientData, costWeights } = get();
    const outputs = await engine.evaluate({ knownFindings, patientData, costWeights });
    set({ ...outputs, lastEvaluatedAt: new Date().toISOString() });
  };

  return {
    knownFindings: [],
    rankedConditions: [],
    importantUnknowns: [],
    actionMap: { catalog: {}, root: { label: "Root" }, transitions: [] },
    patientData: null,
    treatmentRecommendation: undefined,
    lastEvaluatedAt: undefined,
    costWeights: { infoGainWeight: 1.0, money: 0.01, timeHours: 0.1, difficulty: 0.2, risk: 0.5 },
    completedActions: [],

    init: async (patientId) => {
      if (patientId) {
        const p = await PatientHealthService.fetch(patientId);
        set({ patientData: p });
      }
      await recompute();
    },

    addFinding: async (f) => { set(s => ({ knownFindings: [...s.knownFindings, f] })); clearTreatmentsOnChange(); await recompute(); },
    removeFinding: async (id) => { set(s => ({ knownFindings: s.knownFindings.filter(k => k.id !== id) })); clearTreatmentsOnChange(); await recompute(); },
    setPatientData: async (p) => { set({ patientData: p }); clearTreatmentsOnChange(); await recompute(); },
    recompute,

    clearTreatmentRecommendation: () => set({ treatmentRecommendation: undefined }),
    setTreatmentRecommendation: (t) => set({ treatmentRecommendation: t }),

    getActionOutcomes: (actionId) => {
      const { actionMap } = get();
      const catalogEntry = actionMap.catalog[actionId];
      if (!catalogEntry) return null;
      // Merge probabilities from transitions if available
      const transition = actionMap.transitions.find(t => t.actionId === actionId);
      const probByOutcome: Record<string, number> = {};
      if (transition) {
        transition.outcomes.forEach(o => { probByOutcome[o.outcomeId] = o.probEstimate; });
      }
      return {
        outcomes: catalogEntry.outcomes.map(o => ({
          ...o,
          probEstimate: probByOutcome[o.outcomeId] ?? 0
        }))
      };
    },

    setCostWeights: async (w) => { set({ costWeights: w }); await recompute(); },

    applyActionOutcome: async (actionId, outcomeId) => {
      const { actionMap } = get();
      const entry = actionMap.catalog[actionId];
      const outcome = entry?.outcomes.find(o => o.outcomeId === outcomeId);
      if (!outcome) return;
      set(s => {
        const updatedFindings = [...s.knownFindings];
        for (const eff of (outcome as any).effects ?? []) {
          const idx = updatedFindings.findIndex(f => f.id === (eff.findingId as string));
          const next = { id: eff.findingId as string, presence: eff.presence, value: eff.value, daysSinceOnset: eff.daysSinceOnset } as KnownFinding;
          if (idx >= 0) updatedFindings[idx] = { ...updatedFindings[idx], ...next };
          else updatedFindings.push(next);
        }
        return {
          knownFindings: updatedFindings,
          completedActions: [...(s.completedActions ?? []), { actionId, outcomeId, at: new Date().toISOString() }],
          treatmentRecommendation: undefined,
        };
      });
      await recompute();
    },
  };
}));
```

### PatientHealthService
- File: `src/app/services/PatientHealthService.ts`
- Abstract the data source (EHR, local cache, API). Provide sync and subscription.

```ts
export interface PatientHealthService {
  fetch(patientId: string): Promise<PatientData>;
  subscribe(patientId: string, onUpdate: (p: PatientData) => void): () => void; // returns unsubscribe
}

export const PatientHealthService: PatientHealthService = {
  async fetch(patientId) {
    // TODO: Implement. For now, return mock or fetch from API.
    return { demographics: { age: 35, sexAtBirth: "female" }, vitals: {}, labs: {}, history: {}, medications: [], allergies: [] };
  },
  subscribe(patientId, onUpdate) {
    // Optional: wire to streaming updates; call onUpdate with new data
    return () => {};
  }
};
```
### Agent bridge
- File: `src/app/agent/AgentBridge.ts`
- Capabilities mapped to store and engine facade.

```ts
import { useHealthStore } from "@/app/state/healthStore";
import { createEngineFacade } from "@/engine/facade";

export const Agent = {
  readHealthState: () => useHealthStore.getState(),

  readConditionInformation: async (conditionId: string) => {
    const engine = await createEngineFacade();
    return engine.getConditionGraph(conditionId); // full JSON + deps from @content
  },

  addFinding: async (finding) => useHealthStore.getState().addFinding(finding),
  removeFinding: async (findingId) => useHealthStore.getState().removeFinding(findingId),

  getActionOutcomes: (actionId: string) => useHealthStore.getState().getActionOutcomes(actionId),

  addRecommendedTreatment: (treatment) => useHealthStore.getState().setTreatmentRecommendation(treatment),
  // Additional capabilities for parity with game loop
  applyActionOutcome: (actionId: string, outcomeId: string) => useHealthStore.getState().applyActionOutcome(actionId, outcomeId),
  readActionRanking: () => useHealthStore.getState().actionRanking,
  readActionMap: () => useHealthStore.getState().actionMap,
};
```

### UI integration (`@top.tsx`, `@bottom.tsx`)
- Render exclusively from the store.
- Add user interactions that dispatch to store actions.
- Add an “Update treatment recommendation” button that:
  - Calls `clearTreatmentRecommendation()`
  - Triggers the agent to compute a new recommendation and then `setTreatmentRecommendation(...)`
 - Show triage banner when `triage.urgent` is true and list `triage.flags`.
 - Display `actionRanking` list with utility and costs; allow selecting an action, then present its outcomes (via `getActionOutcomes`) and apply with `applyActionOutcome`.
 - Optionally render the `actionMap.transitions` as Mermaid or another visualization.

Minimal example usage:
```tsx
// @top.tsx
const Top = () => {
  const rankedConditions = useHealthStore(s => s.rankedConditions);
  const treatment = useHealthStore(s => s.treatmentRecommendation);
  return (
    <>
      <ConditionsList items={rankedConditions} />
      <TreatmentCard treatment={treatment} />
      <button onClick={async () => {
        useHealthStore.getState().clearTreatmentRecommendation();
        const state = useHealthStore.getState();
        // invoke Agent to recompute (pseudo)
        const treatment = await AgentComputeTreatment(state);
        useHealthStore.getState().setTreatmentRecommendation(treatment);
      }}>
        Update treatment recommendation
      </button>
    </>
  );
};
```

```tsx
// @bottom.tsx
const Bottom = () => {
  const findings = useHealthStore(s => s.knownFindings);
  const unknowns = useHealthStore(s => s.importantUnknowns);
  const addFinding = useHealthStore(s => s.addFinding);
  const removeFinding = useHealthStore(s => s.removeFinding);

  return (
    <>
      <FindingsEditor findings={findings} onAdd={addFinding} onRemove={id => removeFinding(id)} />
      <UnknownsList items={unknowns} />
    </>
  );
};
```

### Content usage (`src/content`)
- Engine facade loads `conditions.json`, `findings.json`, `actions.json`, etc., and compiles them on startup.
- `readConditionInformation` returns the full object graph (condition + linked findings/actions) to allow the agent to reason over dependencies without re-reading the content directly in the agent.
 - `getActionOutcomes(actionId)` surfaces outcome effects (presence/value/daysSinceOnset) so the application layer can apply them to `knownFindings` and `completedActions`.

### API updates
- Deprecate `src/app/api/chat/route.tsx` as a data source for the UI.
- Option A: Remove it completely.
- Option B: Repurpose it for agent-assist utilities (e.g., condense rationale text), but never as a UI state source.

### State invalidation rules
- On `knownFindings` or `patientData` changes:
  - Clear `treatmentRecommendation`.
  - Recompute engine outputs (`rankedConditions`, `importantUnknowns`, `actionMap`).
- On `recompute()`:
  - Update `lastEvaluatedAt`.
- On `costWeights` change:
  - Recompute action ranking and recommendation.
- On `applyActionOutcome`:
  - Update `knownFindings` and append to `completedActions`, clear treatments, then recompute.

### Testing (lightweight for hackathon)
- Manual validation using the game content and a small UI playground.
- Basic smoke tests: engine facade evaluate() returns objects with required fields; store mutations recompute and clear treatments as specified.

### Performance and reliability
- Compile content once; memoize or cache inside the engine facade.
- Debounce rapid `addFinding` sequences if needed (batch updates).
- Graceful error handling on evaluation; surface minimal UI notifications while keeping last good results.

### Implementation steps
1. Create `EngineFacade` over existing `src/engine/*` that exposes `evaluate()` and `getConditionGraph()`.
2. Define shared types for `HealthState` and map/align them with engine types.
3. Implement `healthStore` (Zustand) with actions and invalidation rules.
4. Implement `PatientHealthService` (mocked first), wire `init(patientId)`.
5. Update `@top.tsx` and `@bottom.tsx` to render from the store and dispatch actions.
6. Remove or repurpose `api/chat/route.tsx`.
7. Implement `AgentBridge` with the required capabilities; add “Update treatment recommendation” UI hook.
8. Add tests for facade and store logic; verify treatment clearing behavior.
9. Add UI/agent pathways for action selection and outcome application; verify triage, action ranking, and action map display.

### Acceptance criteria
- UI renders entirely from `HealthState` in the store.
- Engine is only invoked via the store; `@content/` is the sole domain data source aside from `patientData`.
- Changing findings or patient data clears treatments and recomputes outputs.
- Agent bridge can:
  - read the full `HealthState`
  - read condition info (full JSON/deps)
  - add/remove findings
  - return action outcomes and apply an outcome to update findings/history
  - add recommended treatment
- `PatientHealthService` supplies patient data used in evaluation.
 - `costWeights` changes affect action ranking; triage flags and urgent status are represented in state and UI.

- Refactoring impact: `@route.tsx` no longer drives UI; the store does.

- Short summary:
  - Zustand `HealthState` store is the single UI source of truth.
  - EngineFacade `evaluate({ knownFindings, patientData, costWeights })` returns conditions, unknowns (with impact heuristic), triage, engineRecommendation, action ranking and action map.
  - Store tracks `completedActions`, supports `applyActionOutcome`, and manages `costWeights`.
  - Agent bridge extended with action outcome application and action views.
  - UI renders triage, action ranking/action map, and integrates treatment refresh.