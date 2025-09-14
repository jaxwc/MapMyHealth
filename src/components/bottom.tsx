import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  X,
  Play,
  DollarSign,
  Clock,
  Wrench,
  AlertTriangle,
  TrendingUp
} from "lucide-react";
import { useHealthStore, selectKnownFindings, selectActionRanking } from "@/app/state/healthStore";
import type { KnownFinding } from "@/app/types/health";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";


// Simple Mermaid diagram component (skeleton)
const MermaidDiagram = ({ actionMap }: { actionMap: any }) => (
  <div className="bg-slate-900 border border-slate-600 rounded-lg p-4 min-h-[200px] flex items-center justify-center">
    <p className="text-slate-400 text-sm">
      🧩 Mermaid diagram placeholder
      <br />
      {actionMap?.transitions?.length || 0} action transitions
    </p>
  </div>
);

export default function Bottom() {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  // Store selectors
  const knownFindings = useHealthStore(selectKnownFindings);
  const actionRanking = useHealthStore(selectActionRanking);
  const actionMap = useHealthStore(state => state.actionMap);

  // Store actions
  // Findings editor moved to Top panel
  const getActionOutcomes = useHealthStore(state => state.getActionOutcomes);
  const applyActionOutcome = useHealthStore(state => state.applyActionOutcome);

  //

  const handleApplyAction = async () => {
    if (!selectedAction || !selectedOutcome) return;

    await applyActionOutcome(selectedAction, selectedOutcome);
    setSelectedAction(null);
    setSelectedOutcome(null);
  };

  const selectedActionOutcomes = selectedAction ? getActionOutcomes(selectedAction) : null;

  return (
    <ScrollArea className="h-full w-full rounded-xl border border-pink-500/30 bg-slate-800 p-6 space-y-6">
      {/* Findings Editor moved to Top panel */}

      {/* Action Ranking */}
      <div>
        <h3 className="text-lg font-semibold text-slate-100 mb-4">
          ⚡ Recommended Actions
        </h3>
        {actionRanking.length === 0 ? (
          <p className="text-sm text-slate-400">Add findings to determine.</p>
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
                  <div className="text-xs text-slate-400">
                    Info Gain: {action.expectedInfoGain.toFixed(3)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Action Outcome Selection */}
      {selectedAction && selectedActionOutcomes && (
        <div>
          <h3 className="text-lg font-semibold text-slate-100 mb-4">
            🎯 Select Outcome
          </h3>
          <div className="bg-slate-700/50 rounded-lg p-4">
            <p className="text-slate-300 mb-3">
              Action: <strong>{actionRanking.find(a => a.actionId === selectedAction)?.label}</strong>
            </p>
            <div className="grid gap-2 mb-4">
              {selectedActionOutcomes.outcomes.map((outcome) => (
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
                    <span className="text-xs text-slate-400">
                      {(outcome.probEstimate * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleApplyAction}
                disabled={!selectedOutcome}
                size="sm"
              >
                <Play className="w-4 h-4 mr-2" />
                Apply Outcome
              </Button>
              <Button
                onClick={() => {
                  setSelectedAction(null);
                  setSelectedOutcome(null);
                }}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mermaid Diagram */}
      {actionMap && actionMap.transitions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-slate-100 mb-4">
            🌳 Action Decision Tree
          </h3>
          <MermaidDiagram actionMap={actionMap} />
        </div>
      )}
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  );
}