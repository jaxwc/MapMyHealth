import { HealthData } from '@/app/page';

const Node = ({ title }: { title: string }) => (
  <div className="bg-slate-700 border-2 border-cyan-400 rounded-lg p-4 text-center shadow-lg shadow-cyan-400/20 min-w-[150px]">
    <p className="font-semibold text-cyan-300">{title}</p>
  </div>
);

interface DiagramPanelProps {
  data: HealthData | null;
}

export default function DiagramPanel({ data }: DiagramPanelProps) {
  if (!data) {
    return (
      <div className="w-full h-full bg-slate-800 rounded-xl border border-pink-500/30 flex items-center justify-center p-8">
        <p className="text-slate-500 text-lg">Health Roadmap</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-800 rounded-xl border border-pink-500/30 p-8 flex flex-col items-center justify-center space-y-12 relative">
      <Node title="Health State" />

      <div className="flex flex-wrap justify-center gap-6 max-w-full">
        {data.conditions.map((condition, index) => (
          <Node key={index} title={condition} />
        ))}
      </div>
    </div>
  );
}