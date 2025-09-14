# MapMyHealth — Demo Specification (Two-Folder Edition)

> Educational prototype only. Not medical advice. Always triage red flags first; recommendations are non-prescriptive categories (e.g., “supportive care”, “watchful waiting”, “see a clinician”).

This spec defines **structure and behavior** for a minimal, testable demo organized into:

* `src/content/` — seed clinical data packs and configuration
* `src/engine/` — pure functions that score conditions, prioritize actions, plan sequences, and compile user-facing states
* `src/test/` — small unit tests against engine contracts

The UI (two panels) consumes typed outputs from `src/engine/` only; it stores no medical logic.

---

## Folder Layout (required)

```
src/
  content/
    pack.meta.json              # name/version/jurisdiction/source
    findings.json               # symptoms, test findings, history/vitals, red flags
    conditions.json             # condition descriptors, priors, thresholds, LR tables
    actions.json                # tests/questions/wait/treatment-trials with costs & outcomes
    test_performance.json       # test sens/spec (optionally piecewise by time)

  engine/
    types.ts                    # shared TypeScript types (data contracts)
    triage.ts                   # red-flag gate
    beliefs.ts                  # priors + evidence update (LR-based) + normalization
    influence.ts                # value-of-information (VOI) / uncertainty metrics
    planner.ts                  # action ranking and depth-limited branch planning
    compiler.ts                 # beliefs → discrete user-facing clinical states
    viewmodel.ts                # top-panel + action-tree DTOs assembled for UI

  test/
    beliefs.spec.ts
    planner.spec.ts
    compiler.spec.ts
    triage.spec.ts
```

> The **UI** calls `src/engine/viewmodel.buildView(caseState)` and renders the returned DTO.

---

## Core Concepts

### A) Findings (unified evidence)

The fundamental units that contribute to condition scoring.

* **Kinds:** `symptom`, `testFinding`, `vital`, `history`, `redFlag`
* **Presence:** `present | absent | unknown` (unknown is first-class, not “false”)
* **Quant/Temporal:** optional `value`, `units`, `onset`, `durationDays`, `daysSinceOnset`

**Behavioral requirements**

* Engine treats `unknown` as neutral; planners target unknowns with high information value.
* Red flags short-circuit via `triage.ts`.

### B) Conditions

Each condition defines:

* Human description and **non-prescriptive** recommended care categories
* **Priors** (optionally keyed by demographics/season)
* **Thresholds** to classify beliefs into *confirmed/likely/inconclusive*
* **Evidence model**: likelihood ratios (LRs) per **finding or bucket**

**Finding buckets** group correlated features to avoid double-counting (e.g., “Centor cluster”: fever / exudate / tender nodes).

### C) Actions

Steps a user can take; each action has discrete **outcomes** that mutate the health state.

* **Kinds:** `Test`, `Question`, `WaitObserve`, `TrialTreatment` (category-only)
* **Preconditions:** findings/actions required/forbidden before execution
* **Costs:** `money`, `timeHours`, `difficulty`, optional `risk`
* **Outcomes:** labeled branches with probability estimates (optional), and **effects**:

  * Toggle findings (e.g., *Rapid strep: Positive → testFinding present*)
  * Add timing (e.g., wait 48h → *trajectory: improving/worse/no change*)
  * Side-effects (e.g., starting antibiotics → later culture reliability altered)

---

## Engine Data Contracts (TypeScript-style, behavior only)

> Keep code light. Below are **interfaces and function IO contracts** the UI depends on.

### Common Types

* `ID`: opaque string identifier
* `Presence = "present" | "absent" | "unknown"`
* `Recommendation = "urgent-care" | "targeted-care" | "supportive-care" | "watchful-waiting"`

### Content Pack DTOs (from `src/content/`)

* `FindingDef`
  Fields: `id`, `label`, `kind`, `units?`, `isRedFlag?`
  **Used by:** triage, beliefs, planner

* `ConditionDef`
  Fields:

  * `id`, `label`, `description`
  * `priors`: `{ default: number, byDemo?: { ageRange?, sexAtBirth?, season? }[] }`
  * `thresholds`: `{ confirm: number; likely: number; leadDelta: number }`
  * `lrTable`: array of `{ target: findingId | bucketId, LRpos: number, LRneg: number, note?, source }`
  * `recommendations`: mapping from state → `Recommendation` (e.g., confirmed→targeted-care, likely→supportive-care)

* `ActionDef`
  Fields:

  * `id`, `label`, `kind`, `preconditions?: { requireFindings?:[], forbidFindings?:[], requireActions?:[] }`
  * `costs: { money: number; timeHours: number; difficulty: number; risk?: number }`
  * `testBinding?`: `{ findingIdPositive, findingIdNegative, performanceRefId }`
  * `waitBinding?`: `{ hours: number, outcomes: ["improving","worseRF","noChangeNewFinding"], findingEffectsByOutcome }`
  * `outcomes[]`: `{ id, label, probabilityHint?: number, effects: FindingEffect[] }`
  * `sideEffects?`: e.g., `{ suppressFindingIds:[], decayHours?:number }`

* `TestPerformanceDef`
  Fields: `id`, `testId`, `sensitivity`, `specificity`, optional `piecewiseByDaysSinceOnset[]`

* `SourceMeta` everywhere performance/LR appears.

### Case State (from UI to engine)

* `CaseState`
  Fields:

  * `demographics?: { age?, sexAtBirth?, pregnant? }`
  * `findings[]`: `{ findingId, presence, value?, daysSinceOnset? }`
  * `completedActions[]`: `{ actionId, outcomeId, at }`

---

## Engine Modules & Function Contracts

### 1) `triage.ts`

**Purpose:** decide if planning should stop for urgent care.

* `checkRedFlags(caseState, findingDefs) -> { urgent: boolean, flags: findingId[] }`
  **Behavior:** returns `urgent=true` if any red-flag finding is `present`.

### 2) `beliefs.ts`

**Purpose:** compute condition probabilities from priors and current evidence.

* `seedPriors(caseState, conditionDefs) -> Beliefs`
  **Behavior:** returns normalized prior probabilities (use demographics if available; else default).

* `applyEvidence(beliefs, caseState, conditionDefs, testPerf) -> Beliefs`
  **Behavior:**

  * For each finding (or bucket) with `present/absent`, update target condition odds with LR+ / LR−; unknown findings are skipped.
  * Apply **bucket logic**: at most one LR per bucket per condition per pass.
  * Apply time-dependent test performance if `daysSinceOnset` falls into a piecewise band.
  * Normalize at end to sum to 1 (guard against zeros).

* `classify(beliefs, conditionDefs) -> { top: [conditionId, prob][], label: "confirmed" | "likely" | "inconclusive", recommendation: Recommendation }`
  **Behavior:** determine user-facing state using per-condition thresholds and lead delta.

### 3) `influence.ts`

**Purpose:** quantify how much an unknown/data point or an action could change certainty.

* `mostInformativeUnknowns(beliefs, conditionDefs, findingDefs, k=5) -> UnknownInfo[]`
  **UnknownInfo:** `{ findingId, metric: number, rationale }`
  **Behavior:** score unknown findings by expected entropy reduction or expected top-1 gain given plausible outcomes.

* `scoreActionVOI(beliefs, actionDef, conditionDefs, testPerf, costWeights) -> { expectedInfoGain: number, expectedOutcomeProbs: Record<outcomeId, number>, utility: number, previewPosteriors: Record<outcomeId, Beliefs> }`
  **Behavior:** compute outcome posteriors, outcome probabilities (from current beliefs and test sens/spec), information gain, and **cost-weighted utility**:
  `utility = (infoGainWeight * expectedInfoGain) - Σ(weights * costs)`

### 4) `planner.ts`

**Purpose:** rank next actions and generate a shallow branch plan.

* `rankActions(caseState, beliefs, actions, conditionDefs, testPerf, costWeights, k=3) -> RankedAction[]`
  **RankedAction:** `{ actionId, utility, expectedInfoGain, costs, outcomeProbs, previews }`

* `planBranches(caseState, beliefs, actions, conditionDefs, testPerf, costWeights, depth=2, beamWidth=3) -> Branch[]`
  **Branch:**

  ```
  {
    id,
    steps: [
      { actionId, outcomeId?, predictedOutcomeProbs, posteriorPreview, accumCosts }
    ],
    expectedUtility, 
    leafPosteriorPreview
  }
  ```

  **Behavior:** depth-limited expectimax/beam search; respect action preconditions/contraindications; stop early if `classify().label === "confirmed"` or a red flag enters the simulated state.

### 5) `compiler.ts`

**Purpose:** turn beliefs and immediate actions into deterministic **user-facing clinical states** (for the bottom panel’s simple tree and for the top panel’s recommendation).

* `compileState(beliefs, conditionDefs) -> ClinicalStateRoot`
  **ClinicalStateRoot:** `{ stateId:"root", label, recommendation, beliefsTop3 }`

* `compileActionOutcomesForState(rootState, beliefs, rankedActions[0..k], actions, conditionDefs, testPerf) -> StateTree`
  **StateTree:**

  ```
  {
    root: ClinicalStateRoot,
    transitions: [
      { actionId, actionLabel, outcomes: [
        { outcomeId, label, probEstimate, to: { label, recommendation, beliefsTop3 }, deltaCertainty }
      ]}
    ]
  }
  ```

  **Behavior:** build a single-step logic tree (root → action → outcome leaves), with leaf nodes showing the **state the user will land in** if that outcome occurs.

### 6) `viewmodel.ts`

**Purpose:** assemble everything the UI needs (two panels) from the above modules.

* **Input:** `{ caseState, contentPack, userCostWeights }`
* **Output:**

  ```
  {
    triage: { urgent: boolean, flags?: findingId[] },
    topPanel: {
      knownFindings: { present: FindingLite[], absent: FindingLite[] },
      rankedConditions: Array<{ id, label, probability, statusLabel }>,  // top 3–5
      recommendation: Recommendation,
      why: Array<{ conditionId, supporting: FindingChip[], contradicting: FindingChip[] }>,
      mostInformativeUnknowns: Array<{ findingId, label, infoMetric, rationale }>
    },
    bottomPanel: {
      actionRanking: Array<{ actionId, label, utility, expectedInfoGain, costs, outcomeProbs }>,
      actionTree: StateTree,                    // for simple tree rendering
      planPreview?: Array<Branch>               // optional: 2–3 levels deep
    }
  }
  ```

  **Behavior:**

  * Runs `triage`; if urgent, populates top panel with banner and omits planning.
  * Else computes beliefs → classification → VOI → ranked actions → one-step action tree (and optional plan branches).

---

## Behavior Details (algorithms — conceptual, not code)

### Belief Update (LR framework)

* For each **condition C**, start from prior `P(C)`.
* For each **bucket** of findings: if any finding in the bucket is **present**, multiply odds by the bucket’s **LR+** (choose the strongest/appropriate finding per bucket rule); if **absent**, multiply by **LR−**; if **unknown**, skip.
* After all buckets, normalize across conditions to probabilities that sum to 1.
* **Test performance over time:** choose the (sens, spec) band based on `daysSinceOnset` when present; otherwise use default.

### Action VOI (Expected Value of Information)

* For each action outcome, compute **posterior** beliefs (apply its finding effects / test LR).
* Define **certainty metric** (choose one):

  * `Top1Gain = P_top1_after - P_top1_before`, or
  * `EntropyReduction = H(before) - E_outcome[H(after)]`.
* Combine across outcomes: `E[metric] = Σ P(outcome) * metric(outcome)`.
* **Utility** = `infoGainWeight * E[metric] - (w_money*money + w_time*timeHours + w_diff*difficulty + w_risk*risk)`.

### Planner

* **Rank:** score all available actions (meeting preconditions, not violating contraindications). Keep top-K.
* **Sequence:** simulate outcomes to a fixed **depth** (2–3), pruning with **beam width** and deduplicating by posterior hashes. Stop if `confirmed` or if no action improves utility.

### Compiler (Deterministic States)

* Map posterior to **state label** via thresholds:

  * `confirmed`: top P ≥ `confirm` OR a confirming finding is present
  * `likely`: top P ≥ `likely` AND (top − second) ≥ `leadDelta`
  * else `inconclusive`
* Assign **Recommendation** using the condition’s mapping (e.g., confirmed strep → `targeted-care`; likely viral → `watchful-waiting`).
* One-step tree: for each of the top-K ranked actions, generate **outcome leaves** with predicted state labels and **Δcertainty** annotation.

---

## Top Panel & Bottom Panel: Required UI Contracts

### Top Panel must render:

* **Known findings** (present/absent lists) with edit affordance
* **Ranked conditions** (top 3–5) with probability badges and status chips (confirmed/likely/inconclusive)
* **Recommendation category** for the *current* state (never prescriptive)
* **Why** explainer: top 3 supporting / contradicting finding chips for the leading condition
* **Most informative unknowns** (clickable chips) with a short “because…” tooltip

### Bottom Panel must render:

* **Action list** sorted by **utility** with badges: `info ↑`, `cost`, `time`, `difficulty`, `risk`
* **Simple action tree** (one step): action → outcomes; each edge shows **P(outcome)** and **Δcertainty**; each leaf shows **state label** and **recommendation**
* (Optional) **Plan preview** (depth 2–3) with collapsible branches; do not exceed beam width

---

## Safety & Provenance (non-negotiable behaviors)

* If `triage.urgent === true`, **suppress** planner outputs and display an **urgent-care** banner with the list of red flags detected.
* Display a persistent **educational disclaimer**; never output drug names or dosages.
* Every LR or test performance value **must** carry `SourceMeta`; surface it on hover (“Because: LR+≈17, Smith 2020”).
* Highlight **inconsistencies** (e.g., test sequences whose timing invalidates assumptions) with a non-blocking warning chip.

---

## Minimal Seed Content (example scope)

In `src/content/`, ship a tiny adult **acute sore throat** pack:

* **Findings**: sore throat, fever, cough, tonsillar exudates, tender anterior cervical nodes, runny nose, marked fatigue, sore throat >7 days, **rapid strep positive/negative**, **throat culture positive/negative**, **monospot positive/negative**, **red flags** (drooling, stridor, neck swelling with fever)
* **Conditions**: streptococcal pharyngitis, viral pharyngitis, infectious mononucleosis
* **Actions**: Rapid strep (test), Throat culture (test), Monospot (test), Wait & observe 48h (wait)
* **Test performance**: sens/spec for each test; piecewise for monospot (lower sensitivity first 3–5 days)

---

## Engine Inputs/Outputs (end-to-end)

* **Input to engine**:
  `{ caseState, contentPack, userCostWeights }`

* **Output from `viewmodel.buildView`** (UI-ready):

  ```
  {
    triage: { urgent, flags? },
    topPanel: {
      knownFindings: { present[], absent[] },
      rankedConditions: [{ id, label, probability, status }],
      recommendation,
      why: [{ conditionId, supporting[], contradicting[] }],
      mostInformativeUnknowns: [{ findingId, label, infoMetric, rationale }]
    },
    bottomPanel: {
      actionRanking: [{ actionId, label, utility, expectedInfoGain, costs, outcomeProbs }],
      actionTree: {
        root: { label, recommendation, beliefsTop3 },
        transitions: [
          { actionId, actionLabel, outcomes: [
            { outcomeId, label, probEstimate, to:{ label, recommendation, beliefsTop3 }, deltaCertainty }
          ]}
        ]
      },
      planPreview?: Branch[]   // optional depth 2–3
    }
  }
  ```

---

## Tests (in `src/test/`)

* **Beliefs**

  * Seeds priors; updates with a positive & negative test; normalization holds; piecewise sensitivity applied by `daysSinceOnset`.
* **Influence**

  * Highest VOI action is Rapid Strep for sore throat + fever + no cough; VOI decreases when belief already near-certain.
* **Planner**

  * Respects preconditions/contraindications; outputs ≤ beamWidth\*depth branches; stops on `confirmed`.
* **Compiler**

  * Correctly labels `confirmed/likely/inconclusive` based on thresholds and produces a valid one-step action tree.
* **Triage**

  * Any red flag present → urgent=true and planner outputs suppressed.

---

## Extensibility (kept in design even if unused now)

* **Demographic priors** and **jurisdiction** overrides
* **Finding buckets** for correlated evidence
* **Side-effects** that alter subsequent test reliability
* **Entropy vs. top-1 gain** toggle for information metric
* **Multi-diagnosis note** (keep single primary; surface runner-up)
