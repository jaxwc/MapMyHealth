import React, { useEffect, useState } from "react";
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
} from "@/components/ui/dropdown-menu";
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
} from "lucide-react";
import { useHealthStore, selectRankedConditions, selectKnownFindings, selectImportantUnknowns, selectTriage, selectTreatmentRecommendation } from "@/app/state/healthStore";
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

export default function Top() {
  // Get data from store instead of props
  const rankedConditions = useHealthStore(selectRankedConditions);
  const knownFindings = useHealthStore(selectKnownFindings);
  const importantUnknowns = useHealthStore(selectImportantUnknowns);
  const triage = useHealthStore(selectTriage);
  const treatmentRecommendation = useHealthStore(selectTreatmentRecommendation);
  const engineRecommendation = useHealthStore(state => state.engineRecommendation);

  // Store actions
  const init = useHealthStore(state => state.init);
  const addFinding = useHealthStore(state => state.addFinding);
  const removeFinding = useHealthStore(state => state.removeFinding);
  const clearTreatmentRecommendation = useHealthStore(state => state.clearTreatmentRecommendation);
  const setTreatmentRecommendation = useHealthStore(state => state.setTreatmentRecommendation);

  const hasData = rankedConditions.length > 0 || knownFindings.length > 0 || importantUnknowns.length > 0;

  // Content pack: all findings for "+" dropdown
  const [allFindings, setAllFindings] = useState<Array<{ id: string; label?: string }>>([]);
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

  return (
    <ScrollArea className="h-full w-full rounded-lg border border-pink-500/30 bg-slate-800 p-6 flex flex-col space-y-9">
      <div className="flex items-center justify-between flex-shrink-0">
        <h3 className="text-xl font-bold text-slate-100">
          Analysis Summary
        </h3>
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

      {/* Engine Recommendation */}
      {/* {engineRecommendation && (
        <div className="bg-blue-900/50 border border-blue-500/50 rounded-lg p-3 flex-shrink-0">
          <p className="text-blue-200 text-sm font-medium">
            📋 {engineRecommendation}
          </p>
        </div>
      )} */}

      <div className="flex flex-col md:flex-row gap-4">
        {/* Known Findings */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-cyan-400 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" /> Known Findings
            </h4>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="bg-slate-700 border-slate-600 text-slate-200">
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-72 w-64 overflow-auto bg-slate-800 text-slate-200 border-slate-600">
                {allFindings
                  .filter(f => !new Set(knownFindings.filter(k => k.presence === 'present').map(k => k.id)).has(f.id))
                  .map((f) => (
                    <DropdownMenuItem
                      key={f.id}
                      onClick={() => addFinding({ id: f.id, presence: 'present', source: 'user' })}
                      className="cursor-pointer"
                    >
                      {f.label || f.id}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-wrap gap-2">
            {knownFindings.filter(f => f.presence === 'present').slice(0, 20).map((finding, i) => (
              <InfoChip
                key={`${finding.id}-${i}`}
                text={finding.id}
                variant="present"
                onRemove={() => removeFinding(finding.id)}
              />
            ))}
            {knownFindings.filter(f => f.presence === 'present').length === 0 && (
              <p className="text-sm text-slate-400">No findings yet. Use Add to select findings.</p>
            )}
          </div>
        </div>

        {/* Important Unknowns */}
        <div className="flex-1">
          <h4 className="font-semibold text-yellow-400 mb-2 flex items-center gap-2">
            <HelpCircle className="w-5 h-5" /> Important Unknowns
          </h4>
          {knownFindings.length === 0 || importantUnknowns.length === 0 ? (
            <p className="text-sm text-slate-400">Add findings to determine.</p>
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
      <div>
        <h4 className="font-semibold text-pink-400 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" /> Top Conditions
        </h4>
        {knownFindings.length === 0 || rankedConditions.length === 0 ? (
          <p className="text-sm text-slate-400">Add findings to determine.</p>
        ) : (
          <ScrollArea className="w-full">
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
                    <p className="text-sm text-slate-300 mb-2">
                      <strong>{(condition.score * 100).toFixed(1)}%</strong> probability
                    </p>
                    {condition.rationale && (
                      <p className="text-xs text-slate-400">
                        {condition.rationale}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </div>

      {/* Treatment Recommendations */}
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
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
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  );
}
