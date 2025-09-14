import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  const [newFindingId, setNewFindingId] = useState("");
  const [newFindingPresence, setNewFindingPresence] = useState<"present" | "absent">("present");
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  // Store selectors
  const knownFindings = useHealthStore(selectKnownFindings);
  const actionRanking = useHealthStore(selectActionRanking);
  const actionMap = useHealthStore(state => state.actionMap);

  // Store actions
  const addFinding = useHealthStore(state => state.addFinding);
  const removeFinding = useHealthStore(state => state.removeFinding);
  const getActionOutcomes = useHealthStore(state => state.getActionOutcomes);
  const applyActionOutcome = useHealthStore(state => state.applyActionOutcome);

  const handleAddFinding = () => {
    if (!newFindingId.trim()) return;

    const finding: KnownFinding = {
      id: newFindingId.trim(),
      presence: newFindingPresence,
      source: "user"
    };

    addFinding(finding);
    setNewFindingId("");
  };

  const handleApplyAction = async () => {
    if (!selectedAction || !selectedOutcome) return;

    await applyActionOutcome(selectedAction, selectedOutcome);
    setSelectedAction(null);
    setSelectedOutcome(null);
  };

  const selectedActionOutcomes = selectedAction ? getActionOutcomes(selectedAction) : null;

  return (
    <div className="h-full w-full rounded-xl border border-pink-500/30 bg-slate-800 p-6 overflow-y-auto space-y-6">
      {/* Findings Editor */}
      <div>
        <h3 className="text-lg font-semibold text-slate-100 mb-4">
          📋 Findings Editor
        </h3>
        {/* Add New Finding */}
        <div className="bg-slate-700/50 rounded-lg p-4 mb-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-300 block mb-1">
                Finding ID
              </label>
              <Input
                placeholder="e.g., fever, sore_throat"
                value={newFindingId}
                onChange={(e) => setNewFindingId(e.target.value)}
                className="bg-slate-600 border-slate-500 text-slate-100"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-1">
                Presence
              </label>
              <Select value={newFindingPresence} onValueChange={(value: "present" | "absent") => setNewFindingPresence(value)}>
                <SelectTrigger className="w-32 bg-slate-600 border-slate-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddFinding} size="sm">
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>
        </div>

        {/* Current Findings */}
        {knownFindings.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-slate-300">Current Findings:</h4>
            {knownFindings.map((finding, index) => (
              <div key={index} className="flex items-center justify-between bg-slate-600/50 p-3 rounded-md">
                <span className="text-slate-200">
                  <strong>{finding.id}</strong>: {finding.presence}
                  {finding.source && (
                    <span className="text-xs text-slate-400 ml-2">({finding.source})</span>
                  )}
                </span>
                <Button
                  onClick={() => removeFinding(finding.id)}
                  size="sm"
                  variant="destructive"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Ranking */}
      {actionRanking.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-slate-100 mb-4">
            ⚡ Recommended Actions
          </h3>
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
        </div>
      )}

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
    </div>
  );
}