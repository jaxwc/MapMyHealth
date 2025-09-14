import React from "react";


export interface HealthData {
  knowns?: string[];
  unknowns?: string[];
  conditions: { name: string; description: string }[];
  treatments?: string[];
}

const Node = ({ title }: { title: string }) => (
  <div className="bg-slate-700 border-2 border-cyan-400 rounded-lg p-4 text-center shadow-lg shadow-cyan-400/20 min-w-[150px]">
    <p className="font-semibold text-cyan-300">{title}</p>
  </div>
);

interface DiagramPanelProps {
  data: HealthData | null;
}

export default function DiagramPanel({ data }: DiagramPanelProps) {
  if (!data || !data.conditions || data.conditions.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl border border-pink-500/30 bg-slate-800 p-8">
        <p className="text-lg text-slate-500">
          Health graph will appear here...
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full rounded-xl border border-pink-500/30 bg-slate-800 p-8 overflow-y-auto">
      <div className="flex flex-col items-center space-y-12">
        <Node title="Health State" />

        <div className="flex flex-wrap justify-center gap-6">
          {data.conditions.map((condition, index) => (
            <Node key={index} title={condition.name} />
          ))}
        </div>
      </div>
    </div>
  );
}
