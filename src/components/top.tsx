import React, { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  HeartPulse,
  Users,
  RefreshCw,
  Zap,
  Plus,
  X,
  TrendingUp,
  DollarSign,
  Clock,
  Wrench,
} from "lucide-react";
import { useHealthStore, selectRankedConditions, selectKnownFindings, selectImportantUnknowns, selectTriage, selectTreatmentRecommendation, selectActionRanking } from "@/app/state/healthStore";
import { getAvailableMockPatients } from "@/app/services/PatientHealthService";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const InfoChip = ({ text, variant = "default", onRemove }: { text: string; variant?: "default" | "present" | "absent"; onRemove?: () => void }) => {
  const bgColor = variant === "present" ? "bg-green-700/50" :
                  variant === "absent" ? "bg-red-700/50" :
                  "bg-slate-700/50";

  return (
    <div className={`${bgColor} px-2 py-1 rounded-md text-slate-200 text-sm inline-flex items-center gap-2` }>
      <span className="truncate max-w-[220px]">{text}</span>
      {onRemove && (
        <button
          aria-label="Remove"
          className="rounded-full p-0.5 hover:bg-slate-600/60 text-slate-100"
          onClick={onRemove}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

// Helper function to format status labels
const formatStatusLabel = (statusLabel: string) => {
  const labels: Record<string, string> = {
    'highly-likely': 'Highly Likely',
    'likely': 'Likely',
    'unknown': 'Possible',
    'possible': 'Possible',
    'not-likely': 'Not Likely',
    'very-unlikely': 'Very Unlikely'
  };
  return labels[statusLabel] || statusLabel;
};

// Helper function to get status color
const getStatusColor = (statusLabel: string) => {
  const colors: Record<string, string> = {
    'highly-likely': 'text-red-400',
    'likely': 'text-orange-400',
    'unknown': 'text-yellow-400',
    'possible': 'text-yellow-400',
    'not-likely': 'text-blue-400',
    'very-unlikely': 'text-green-400'
  };
  return colors[statusLabel] || 'text-slate-400';
};

// Mermaid diagram component
const MermaidDiagram = ({ actionMap }: { actionMap: any }) => {
  const mermaidRef = useRef<HTMLDivElement>(null);
  const [diagramId] = useState(`mermaid-${Math.random().toString(36).slice(2, 11)}`);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!mermaidRef.current || !actionMap?.transitions?.length) return;

      try {
        // Dynamic import to avoid SSR issues
        const mermaid = (await import('mermaid')).default;

        // Initialize mermaid with dark theme
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: {
            primaryColor: '#3b82f6',
            primaryTextColor: '#e2e8f0',
            primaryBorderColor: '#475569',
            lineColor: '#64748b',
            secondaryColor: '#1e293b',
            tertiaryColor: '#0f172a',
            background: '#0f172a',
            mainBkg: '#1e293b',
            secondBkg: '#334155',
            tertiaryBkg: '#475569'
          }
        });

        // Generate mermaid syntax from actionMap
        let mermaidSyntax = 'flowchart TD\n';

        // Add root node
        mermaidSyntax += `  Start["${actionMap.root.label}"]\n`;

        // Add transitions
        actionMap.transitions.forEach((transition: any, index: number) => {
          const actionId = `A${index}`;
          mermaidSyntax += `  ${actionId}["${transition.actionLabel}"]\n`;
          mermaidSyntax += `  Start --> ${actionId}\n`;

          // Add outcomes
          transition.outcomes.forEach((outcome: any, outcomeIndex: number) => {
            const outcomeId = `O${index}_${outcomeIndex}`;
            mermaidSyntax += `  ${outcomeId}["${outcome.label}"]\n`;
            mermaidSyntax += `  ${actionId} --> ${outcomeId}\n`;

            // Link to outcome destination if available
            if (outcome.to?.label) {
              const destId = `D${index}_${outcomeIndex}`;
              mermaidSyntax += `  ${destId}["${outcome.to.label}"]\n`;
              mermaidSyntax += `  ${outcomeId} --> ${destId}\n`;
            }
          });
        });

        // Add styling
        mermaidSyntax += `
  classDef default fill:#1e293b,stroke:#475569,stroke-width:2px,color:#e2e8f0
  classDef action fill:#3b82f6,stroke:#1d4ed8,stroke-width:2px,color:#ffffff
  classDef outcome fill:#059669,stroke:#047857,stroke-width:2px,color:#ffffff
  classDef destination fill:#dc2626,stroke:#b91c1c,stroke-width:2px,color:#ffffff
`;

        // Clear previous content and render
        mermaidRef.current.innerHTML = '';
        const { svg } = await mermaid.render(diagramId, mermaidSyntax);
        mermaidRef.current.innerHTML = svg;

        // Apply additional styling to the rendered SVG
        const svgElement = mermaidRef.current.querySelector('svg');
        if (svgElement) {
          svgElement.style.width = '100%';
          svgElement.style.height = 'auto';
          svgElement.style.minHeight = '200px';
        }

      } catch (error) {
        console.error('Error rendering mermaid diagram:', error);
        if (mermaidRef.current) {
          mermaidRef.current.innerHTML = `
            <div class="text-center text-slate-400 py-8">
              <p>Error rendering diagram</p>
              <p class="text-xs mt-2">${actionMap?.transitions?.length || 0} action transitions available</p>
            </div>
          `;
        }
      }
    };

    renderDiagram();
  }, [actionMap, diagramId]);

  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg p-4 min-h-[200px] overflow-auto">
      <div ref={mermaidRef} className="mermaid-diagram" />
    </div>
  );
};

export default function Top() {
  // Get data from store instead of props
  const rankedConditions = useHealthStore(selectRankedConditions);
  const knownFindings = useHealthStore(selectKnownFindings);
  const importantUnknowns = useHealthStore(selectImportantUnknowns);
  const triage = useHealthStore(selectTriage);
  const treatmentRecommendation = useHealthStore(selectTreatmentRecommendation);
  const actionRanking = useHealthStore(selectActionRanking);
  const actionMap = useHealthStore(state => state.actionMap);
  const escalationResult = useHealthStore(state => state.escalationResult);

  // Store actions
  const init = useHealthStore(state => state.init);
  const replaceAll = useHealthStore(state => (state as any).replaceAll);
  const getActionOutcomes = useHealthStore(state => state.getActionOutcomes);
  const applyActionOutcome = useHealthStore(state => state.applyActionOutcome);
  const clearTreatmentRecommendation = useHealthStore(state => state.clearTreatmentRecommendation);
  const setTreatmentRecommendation = useHealthStore(state => state.setTreatmentRecommendation);

  const hasPresentFindings = knownFindings.some(f => f.presence === 'present');

  // Hydrate client store from server snapshot on app reload
  useEffect(() => {
    const hydrate = async () => {
      try {
        const res = await fetch('/api/state', { cache: 'no-store' });
        if (!res.ok) return;
        const snapshot = await res.json();
        if (snapshot && typeof snapshot === 'object') {
          replaceAll(snapshot);
        }
      } catch (e) {
        console.warn('Hydration from /api/state failed', e);
      }
    };
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Content pack: all findings for "+" dropdown
  const [allFindings, setAllFindings] = useState<Array<{ id: string; label?: string }>>([]);
  const [findingFilter, setFindingFilter] = useState("");
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/content-pack');
        const json = await res.json();
        if (json?.findings) {
          setAllFindings(json.findings);
        }
      } catch {
        // no-op if fails; UI will still work without dropdown
      }
    };
    load();
  }, []);

  // Mock treatment generation for the button
  const handleUpdateTreatment = async () => {
    clearTreatmentRecommendation();

    // TODO: Replace with actual agent call
    setTimeout(() => {
      const mockTreatment = {
        generatedAt: new Date().toISOString(),
        rationale: "Based on current symptoms and condition probabilities",
        recommendations: rankedConditions.slice(0, 2).map(condition => ({
          conditionId: condition.id,
          title: `Treatment for ${condition.name}`,
          details: `Consider supportive care and monitoring. Probability: ${(condition.score * 100).toFixed(1)}%`,
          strength: "B" as "A" | "B" | "C"
        }))
      };
      setTreatmentRecommendation(mockTreatment);
    }, 1000);
  };

  // Actions UI state
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const selectedActionOutcomes = selectedAction ? getActionOutcomes(selectedAction) : null;
  const handleApplyAction = async () => {
    if (!selectedAction || !selectedOutcome) return;
    try {
      const res = await fetch('/api/state/mutate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'applyActionOutcome', payload: { actionId: selectedAction, outcomeId: selectedOutcome } })
      });
      const snapshot = await res.json();
      replaceAll(snapshot);
    } catch (e) {
      console.error('Server applyActionOutcome failed', e);
    }
    setSelectedAction(null);
    setSelectedOutcome(null);
  };

  return (
    <ScrollArea className="h-full w-full min-w-0 rounded-lg border border-pink-500/30 bg-slate-800 p-6">
      <div className="flex flex-col space-y-9">
        <div className="flex items-center justify-between flex-shrink-0">
          <h3 className="text-xl font-bold text-slate-100">
            Health Analysis
          </h3>
          {/* Patient Select */}
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <Select defaultValue="patient-001" onValueChange={(value) => init(value)}>
              <SelectTrigger className="w-40 bg-slate-700 border-slate-600 text-slate-200">
                <SelectValue placeholder="Select patient" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 text-slate-200 border-slate-600">
                {getAvailableMockPatients().map(patient => (
                  <SelectItem key={patient.id} value={patient.id}>
                    {patient.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

      {/* Triage Banner */}
      {triage?.urgent && (
        <div className="bg-red-900/50 border border-red-500/50 rounded-lg p-4 flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h4 className="font-bold text-red-400">URGENT CARE REQUIRED</h4>
          </div>
          {triage.flags && triage.flags.length > 0 && (
            <p className="text-red-200 text-sm">
              Red flags detected: {triage.flags.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Escalation Banner */}
      {escalationResult && escalationResult.escalations.length > 0 && (
        <div className="bg-orange-900/50 border border-orange-500/50 rounded-lg p-4 flex-shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-6 h-6 text-orange-400" />
            <h4 className="font-bold text-orange-100 text-lg">Contact Your Healthcare Provider</h4>
          </div>
          <div className="space-y-2">
            <p className="text-orange-100 text-base font-medium">
              Your symptoms may be worsening. It's recommended that you contact your healthcare provider or consider seeking medical care.
            </p>
            {escalationResult.requiresReevaluation && (
              <div className="bg-orange-700/50 rounded p-3 mt-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-300 rounded-full"></div>
                  <p className="text-orange-100 font-medium">
                    Schedule an appointment or visit urgent care
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      <div className="flex flex-col md:flex-row gap-4 min-w-0">
        {/* Known Findings */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-cyan-400 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" /> Known Findings
            </h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {knownFindings.filter(f => f.presence === 'present').slice(0, 20).map((finding, i) => (
              <InfoChip
                key={`${finding.id}-${i}`}
                text={finding.id}
                variant="present"
                onRemove={async () => {
                  try {
                    const res = await fetch('/api/state/mutate', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ op: 'removeFinding', payload: { id: finding.id } })
                    });
                    const snapshot = await res.json();
                    replaceAll(snapshot);
                  } catch (e) {
                    console.error('Server removeFinding failed', e);
                  }
                }}
              />
            ))}
            {knownFindings.filter(f => f.presence === 'present').length === 0 && (
              <p className="text-sm text-slate-400">No findings yet. Use Add to select findings.</p>
            )}
            {/* Always show Add at end of list */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="bg-slate-700 border-slate-600 text-slate-200">
                  <Plus className="w-4 h-4 mr-1" /> Add Finding
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-72 w-64 overflow-auto bg-slate-800 text-slate-200 border-slate-600">
                <div className="px-2 pt-2">
                  <Input
                    placeholder="Filter findings..."
                    value={findingFilter}
                    onChange={(e) => setFindingFilter(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="h-8 bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-400"
                  />
                </div>
                <DropdownMenuSeparator className="my-2 bg-slate-700" />
                {allFindings
                  .filter(f => !new Set(knownFindings.filter(k => k.presence === 'present').map(k => k.id)).has(f.id))
                  .filter(f => {
                    const q = findingFilter.trim().toLowerCase();
                    if (!q) return true;
                    const label = (f.label || "").toLowerCase();
                    return f.id.toLowerCase().includes(q) || label.includes(q);
                  })
                  .map((f) => (
                    <DropdownMenuItem
                      key={f.id}
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/state/mutate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ op: 'addFinding', payload: { id: f.id, presence: 'present', source: 'user' } })
                          });
                          const snapshot = await res.json();
                          replaceAll(snapshot);
                        } catch (e) {
                          console.error('Server addFinding failed', e);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      {f.label || f.id}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Important Unknowns */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-yellow-400 mb-2 flex items-center gap-2">
            <HelpCircle className="w-5 h-5" /> Important Unknowns
          </h4>
          {!hasPresentFindings || importantUnknowns.length === 0 ? (
            <p className="text-sm text-slate-400">Add symptoms to determine important unknowns.</p>
          ) : (
            <div className="flex flex-col space-y-2">
              {importantUnknowns.slice(0, 5).map((unknown, i) => (
                <InfoChip key={i} text={unknown.prompt} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ranked Conditions */}
      <div className="min-w-0">
        <h4 className="font-semibold text-pink-400 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" /> Top Conditions
        </h4>
        {!hasPresentFindings || rankedConditions.length === 0 ? (
          <p className="text-sm text-slate-400">Add symptoms to see condition rankings.</p>
        ) : (
          <ScrollArea className="w-full max-w-full min-w-0">
            <div className="w-max">
              <div className="flex gap-4 pb-4">
                {rankedConditions.slice(0, 5).map((condition, i) => (
                  <Card
                    key={i}
                    className="w-[280px] flex-shrink-0 rounded-lg bg-slate-700/40 border-pink-500/30 text-slate-200"
                  >
                    <CardHeader>
                      <CardTitle className="text-pink-400">
                        {condition.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-3">
                        <div className={`text-lg font-bold ${getStatusColor(condition.statusLabel)} mb-1`}>
                          {formatStatusLabel(condition.statusLabel)}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          {(condition.score * 100).toFixed(1)}% probability
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </div>

      {/* Treatment Recommendations */}
      <div className="flex-shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <h4 className="font-semibold text-green-400 flex items-center gap-2">
            <HeartPulse className="w-5 h-5" /> Treatment Recommendations
          </h4>
          <Button
            onClick={handleUpdateTreatment}
            size="sm"
            variant="outline"
            className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Update Treatment
          </Button>
        </div>

        {knownFindings.length === 0 ? (
          <p className="text-slate-400 text-sm">Add findings to determine.</p>
        ) : treatmentRecommendation ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 mb-3">
              Generated: {new Date(treatmentRecommendation.generatedAt).toLocaleString()}
            </p>
            {treatmentRecommendation.recommendations.map((rec, i) => (
              <div key={i} className="bg-green-900/30 border border-green-500/30 rounded-md p-3">
                <h5 className="font-medium text-green-300">{rec.title}</h5>
                {rec.details && (
                  <p className="text-sm text-green-200 mt-1">{rec.details}</p>
                )}
                {rec.strength && (
                  <span className="text-xs bg-green-700/50 text-green-200 px-2 py-1 rounded mt-2 inline-block">
                    Strength: {rec.strength}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 text-sm">
            Click "Update Treatment" to generate AI-powered treatment recommendations.
          </p>
        )}
      </div>

      {/* Recommended Actions */}
      <div>
        <h3 className="text-lg font-semibold text-slate-100 mb-4">⚡ Recommended Actions</h3>
        {!hasPresentFindings || actionRanking.length === 0 ? (
          <p className="text-sm text-slate-400">Add symptoms to see recommended actions.</p>
        ) : (
          <div className="grid gap-3">
            {actionRanking.slice(0, 5).map((action) => (
              <Card
                key={action.actionId}
                className={`bg-slate-700/40 border-slate-600 cursor-pointer transition-all ${
                  selectedAction === action.actionId
                    ? 'border-cyan-400 ring-1 ring-cyan-400/50'
                    : 'hover:border-slate-500'
                }`}
                onClick={() => setSelectedAction(action.actionId)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-200 flex items-center justify-between">
                    <span>{action.label}</span>
                    <div className="flex items-center gap-1 text-xs">
                      <TrendingUp className="w-3 h-3 text-green-400" />
                      <span className="text-green-400">{action.utility.toFixed(3)}</span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4 text-slate-300">
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        ${action.costs.money}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {action.costs.timeHours}h
                      </div>
                      <div className="flex items-center gap-1">
                        <Wrench className="w-3 h-3" />
                        {action.costs.difficulty}
                      </div>
                      {action.costs.risk > 0 && (
                        <div className="flex items-center gap-1 text-yellow-400">
                          <AlertTriangle className="w-3 h-3" />
                          {action.costs.risk}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">Info Gain: {action.expectedInfoGain.toFixed(3)}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Action Outcome Selection */}
      {selectedAction && selectedActionOutcomes && (
        <div>
          <h3 className="text-lg font-semibold text-slate-100 mb-4">🎯 Select Outcome</h3>
          <div className="bg-slate-700/50 rounded-lg p-4">
            <p className="text-slate-300 mb-3">
              Action: <strong>{actionRanking.find(a => a.actionId === selectedAction)?.label}</strong>
            </p>
            <div className="grid gap-2 mb-4">
              {selectedActionOutcomes.outcomes.map((outcome: any) => (
                <div
                  key={outcome.outcomeId}
                  className={`p-3 rounded-md cursor-pointer transition-all ${
                    selectedOutcome === outcome.outcomeId
                      ? 'bg-cyan-900/50 border border-cyan-400'
                      : 'bg-slate-600/50 border border-slate-600 hover:border-slate-500'
                  }`}
                  onClick={() => setSelectedOutcome(outcome.outcomeId)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-slate-200">{outcome.description}</span>
                    <span className="text-xs text-slate-400">{(outcome.probEstimate * 100).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleApplyAction} disabled={!selectedOutcome} size="sm">
                Apply Outcome
              </Button>
              <Button
                onClick={() => { setSelectedAction(null); setSelectedOutcome(null); }}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Action Decision Tree */}
      <div>
        <h3 className="text-lg font-semibold text-slate-100 mb-4"> Recommended Next Steps </h3>
        {!hasPresentFindings ? (
          <div className="bg-slate-900 border border-slate-600 rounded-lg p-4 min-h-[200px] flex items-center justify-center">
            <p className="text-slate-400 text-sm text-center">
              No recommended actions available yet.
              <br />
              Try adding symptoms to see diagnostic actions.
            </p>
          </div>
        ) : actionMap && actionMap.transitions.length > 0 ? (
          <MermaidDiagram actionMap={actionMap} />
        ) : (
          <div className="bg-slate-900 border border-slate-600 rounded-lg p-4 min-h-[200px] flex items-center justify-center">
            <p className="text-slate-400 text-sm text-center">
              No actions available for current symptoms.
              <br />
              Try adding more specific symptoms.
            </p>
          </div>
        )}
      </div>
      </div>
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  );
}
