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
  const containerClasses =
    "h-full w-full rounded-xl border border-pink-500/30 bg-slate-800 px-8 pt-8 pb-4 flex flex-col justify-start overflow-y-auto";


  const headerClasses = "text-xl font-bold text-slate-100 mb-8 self-start";

  if (!data || !data.conditions || data.conditions.length === 0) {
    return (
      <div className={`${containerClasses}`}>

        <h2 className={headerClasses}>Health State</h2>
      </div>
    );
  }

  return (
    <div className={containerClasses}>

      <h2 className={headerClasses}>Health State</h2>

      <div className="flex flex-col items-center space-y-12 w-full flex-grow">
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